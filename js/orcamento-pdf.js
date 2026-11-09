/* InvestSolo — Upload de orçamento em PDF com criação automática de obra em "Agendados" */

if (window.pdfjsLib) {
  // Biblioteca e worker ficam dentro do próprio app (js/vendor), sem depender de CDN/internet.
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
}

function parseValorBR(s) {
  return Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
}

function uint8ToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// O pdf.js entrega o texto de cada página como uma lista de fragmentos posicionados,
// sem quebras de linha. Reconstrói as linhas comparando a posição vertical (Y) de
// cada fragmento — essencial para os rótulos (ex.: "A/C –", "VALOR DA EXECUÇÃO")
// serem reconhecidos corretamente pelas expressões regulares.
function textoDaPagina(content) {
  let lastY = null;
  let texto = '';
  content.items.forEach((item) => {
    const y = item.transform ? item.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
      texto += '\n';
    } else if (texto && !texto.endsWith('\n')) {
      texto += ' ';
    }
    texto += item.str;
    lastY = y;
  });
  return texto;
}

// Extração best-effort de dados de um texto de orçamento em PDF. Calibrado com um
// orçamento real da InvestSolo (proposta com "A/C –", "no município de X - UF",
// "N (por extenso) ponto(s) de sondagem" e "VALOR DA EXECUÇÃO"), mas como orçamentos
// podem variar um pouco, a obra é sempre aberta para revisão logo após ser criada.
function parseOrcamentoText(texto) {
  const norm = (texto || '').replace(/\r/g, ' ').replace(/[ \t]+/g, ' ');
  const out = {};

  // Nome do cliente: rótulo (Cliente/Contratante/A/C/...) até o próximo rótulo
  // conhecido, uma quebra de linha real ou o fim do texto.
  let m = norm.match(/(?:Cliente|Contratante|Raz(?:ã|a)o Social|A\/C|Atenção a|À)\s*[:\-–—]\s*([\s\S]{2,80}?)(?:\s+(?:Cidade|Estado|CNPJ|CPF|Endere[cç]o|Munic[ií]pio|Telefone|E-?mail|Data|CEP|Bairro|Ref\.)\b|\n|$)/i);
  if (m) out.clienteTexto = m[1].trim().replace(/[.,;]+$/, '');

  // Cidade/UF: por rótulo explícito, ou pela frase "no município/cidade de X - UF".
  m = norm.match(/(?:Cidade|Local da Obra|Munic[ií]pio)\s*[:\-–—]\s*([^\n\/,]{2,40})/i)
    || norm.match(/munic[ií]pio de\s+([^,\n]+?)\s*[-–]\s*([A-Z]{2})\b/i)
    || norm.match(/cidade de\s+([^,\n]+?)\s*[-–]\s*([A-Z]{2})\b/i);
  if (m) { out.cidade = m[1].trim(); if (m[2]) out.estado = m[2].toUpperCase(); }
  if (!out.estado) {
    m = norm.match(/\b([A-Z]{2})\b\s*[-–]?\s*(?:CEP|Brasil|\n)/) || norm.match(/\/\s*([A-Z]{2})\b/);
    if (m) out.estado = m[1];
  }

  const tipos = ['SPT', 'CPT', 'Rotativa', 'Mista', 'Trado'];
  const tipoEncontrado = tipos.find(t => new RegExp(`\\b${t}\\b`, 'i').test(norm));
  if (tipoEncontrado) out.tipoSondagem = tipoEncontrado;

  // Quantidade de pontos: prioriza "N (por extenso) ponto(s) de sondagem" e cai
  // para "N pontos/furos/sondagens" genérico se não encontrar.
  m = norm.match(/(\d+)\s*(?:\([^)]{0,20}\))?\s*pontos?\s+de\s+sondagem/i)
    || norm.match(/(\d+)\s*(?:pontos|furos|sondagens)\b/i);
  if (m) out.quantidadePontos = Number(m[1]);

  // Valor: procura rótulos de total conhecidos, na ordem de prioridade (não exige
  // "R$" colado no número, já que na tabela o "R$" costuma ficar só no cabeçalho).
  const labelsValor = ['VALOR\\s+DA\\s+EXECU\\S*', 'VALOR\\s+TOTAL', 'TOTAL\\s+GERAL', 'TOTAL'];
  let valorEncontrado = null;
  for (const lbl of labelsValor) {
    const mm = norm.match(new RegExp(lbl + '[^\\d]{0,20}([\\d.]+,\\d{2})', 'i'));
    if (mm) { valorEncontrado = parseValorBR(mm[1]); break; }
  }
  if (valorEncontrado !== null) {
    out.valorPrevisto = valorEncontrado;
  } else {
    const valores = [...norm.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map(mm => parseValorBR(mm[1]));
    if (valores.length) out.valorPrevisto = Math.max(...valores);
  }

  // Prazo do relatório: prioriza a menção específica de laudo/relatório (evita
  // confundir com outros prazos do orçamento, como início dos trabalhos).
  m = norm.match(/(?:laudo t[eé]cnico|relat[oó]rio)[^\n\d]{0,60}?(\d+)\s*dias?/i)
    || norm.match(/\bprazo\s+de\s+(\d+)\s*dias?/i);
  if (m) out.prazoDias = Number(m[1]);

  m = norm.match(/Proposta\s*n[ºo°]?\s*(\d+)/i);
  if (m) out.numeroProposta = m[1];

  return out;
}

// Procura um cliente já cadastrado que bata com o nome extraído do PDF; se não
// achar nenhum e o nome foi identificado, cadastra um cliente novo automaticamente
// (copiando o mesmo nome usado no nome da obra) em vez de deixar a obra "órfã"
// ou vinculada por engano a outro cliente qualquer.
function encontrarOuCriarCliente(dados, nomeArquivo, refProposta) {
  const clientes = DB.getClientes();
  if (dados.clienteTexto) {
    const q = dados.clienteTexto.toLowerCase();
    const match = clientes.find(c =>
      q.includes(c.nome.toLowerCase()) ||
      (c.empresa && q.includes(c.empresa.toLowerCase())) ||
      q.includes(c.nome.toLowerCase().split(' ')[0])
    );
    if (match) return { cliente: match, criado: false };

    const novoCliente = {
      id: uid('cli'),
      nome: dados.clienteTexto,
      empresa: '',
      cpfCnpj: '',
      whatsapp: '',
      email: '',
      cidade: dados.cidade || '',
      estado: dados.estado || '',
      endereco: '',
      observacoes: `Cadastro criado automaticamente a partir do orçamento "${nomeArquivo}"${refProposta}. Confira/complete telefone, email e demais dados de contato.`,
    };
    DB.upsertCliente(novoCliente);
    return { cliente: novoCliente, criado: true };
  }
  return { cliente: null, criado: false };
}

function criarObraDeOrcamento(dados, nomeArquivo, dataURL) {
  const refProposta = dados.numeroProposta ? ` (Proposta nº ${dados.numeroProposta})` : '';
  const { cliente, criado } = encontrarOuCriarCliente(dados, nomeArquivo, refProposta);

  const nomeObra = dados.tipoSondagem
    ? `Sondagem ${dados.tipoSondagem}${cliente ? ' — ' + cliente.nome : ''}`
    : (cliente ? `Orçamento — ${cliente.nome}` : `Nova obra (orçamento ${nomeArquivo})`);

  const usuario = Auth.getCurrentUser();
  const obs = [`Obra criada automaticamente a partir do orçamento "${nomeArquivo}"${refProposta}. Confira e complete os dados antes de agendar a equipe.`];
  if (criado) {
    obs.push(`Cliente "${cliente.nome}" cadastrado automaticamente a partir deste orçamento — confira/complete os dados de contato em Clientes.`);
  } else if (!cliente) {
    obs.push('Não foi possível identificar o cliente no PDF; selecione ou cadastre o cliente manualmente.');
  }

  const historico = [{
    data: new Date().toISOString(),
    usuario: usuario ? usuario.nome : 'Sistema',
    acao: `Obra criada automaticamente a partir do orçamento em PDF "${nomeArquivo}"${refProposta}`,
  }];
  if (criado) {
    historico.unshift({
      data: new Date().toISOString(),
      usuario: usuario ? usuario.nome : 'Sistema',
      acao: `Cliente "${cliente.nome}" cadastrado automaticamente a partir do orçamento "${nomeArquivo}"${refProposta}`,
    });
  }

  const base = novaObraVazia({ status: 'agendados' });
  const obra = {
    ...base,
    id: uid('obr'),
    nomeObra,
    clienteId: cliente ? cliente.id : '',
    empresaContratante: cliente ? (cliente.empresa || '') : '',
    cidade: dados.cidade || (cliente ? cliente.cidade : ''),
    estado: dados.estado || (cliente ? cliente.estado : ''),
    endereco: cliente ? cliente.endereco : '',
    tipoSondagem: dados.tipoSondagem || base.tipoSondagem,
    quantidadePontos: dados.quantidadePontos || '',
    valorPrevisto: dados.valorPrevisto || '',
    prazoRelatorio: dados.prazoDias ? addDaysISO(todayISO(), dados.prazoDias) : '',
    status: 'agendados',
    observacoes: obs.join(' '),
    anexos: dataURL ? [{ nome: nomeArquivo, tipo: 'application/pdf', dataURL }] : [],
    historico,
  };
  DB.upsertObra(obra);
  return obra;
}

// Lê o PDF e devolve o texto. Se a leitura falhar, devolve null (a obra ainda é
// criada, só que sem preenchimento automático).
async function extrairTextoDoPdf(bytes) {
  try {
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    let texto = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      texto += textoDaPagina(content) + '\n';
    }
    return texto;
  } catch (err) {
    console.error('Erro lendo texto do PDF', err);
    return null;
  }
}

// Grava a obra. O navegador guarda tudo no localStorage (limite de ~5 MB); como o
// PDF é anexado dentro da obra, depois de alguns orçamentos o espaço pode acabar.
// Nesse caso grava a obra sem o anexo, em vez de perder o cadastro.
function gravarObraDoOrcamento(dados, nomeArquivo, dataURL) {
  try {
    return { obra: criarObraDeOrcamento(dados, nomeArquivo, dataURL), semAnexo: false };
  } catch (err) {
    console.error('Erro gravando obra com anexo', err);
    const obra = criarObraDeOrcamento(dados, nomeArquivo, null);
    return { obra, semAnexo: true };
  }
}

async function handleOrcamentoFile(file) {
  const ehPdf = (file.type && file.type.includes('pdf')) || /\.pdf$/i.test(file.name || '');
  if (!ehPdf) {
    toast('Selecione um arquivo PDF.', 'error');
    return;
  }
  if (!window.pdfjsLib) {
    toast('A biblioteca de leitura de PDF não carregou. Atualize a página (Ctrl+F5) e tente novamente.', 'error');
    return;
  }
  toast('Lendo orçamento em PDF...', 'info');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const dataURL = `data:application/pdf;base64,${uint8ToBase64(bytes)}`;

    const texto = await extrairTextoDoPdf(bytes);
    const leu = texto !== null && texto.trim().length > 0;
    const dados = leu ? parseOrcamentoText(texto) : {};

    const { obra, semAnexo } = gravarObraDoOrcamento(dados, file.name, dataURL);

    const camposLidos = ['clienteTexto', 'cidade', 'tipoSondagem', 'quantidadePontos', 'valorPrevisto', 'prazoDias'].filter(k => dados[k]).length;
    if (!leu) {
      toast('Não consegui ler o texto deste PDF (pode ser imagem escaneada). A obra foi criada em "Agendados" com o PDF anexado — preencha os dados manualmente.', 'info');
    } else if (semAnexo) {
      toast('Obra criada com os dados do orçamento, mas SEM o PDF anexado: o armazenamento do navegador está cheio. Exclua anexos antigos de obras para liberar espaço.', 'info');
    } else if (camposLidos < 3) {
      toast('Obra criada, mas poucos dados foram reconhecidos no PDF. Revise e complete.', 'info');
    } else {
      toast('Obra criada em "Agendados" a partir do orçamento. Revise os dados.', 'success');
    }
    Views.refreshCurrent();
    if (window.Dashboard) Dashboard.refreshIndicators();
    openObraModal(obra.id);
  } catch (err) {
    console.error('Erro ao processar orçamento em PDF', err);
    toast('Não foi possível criar a obra a partir deste PDF (' + (err && err.message ? err.message : 'erro desconhecido') + ').', 'error');
  }
}

function criarUploadOrcamento() {
  const input = el('input', { type: 'file', accept: 'application/pdf', class: 'hidden' });
  const btn = el('button', { class: 'btn btn-ghost', type: 'button', title: 'Carregar um orçamento em PDF e criar a obra automaticamente' }, 'Carregar orçamento (PDF)');
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = '';
    if (file) handleOrcamentoFile(file);
  });
  return el('span', { style: 'display:inline-flex;' }, [btn, input]);
}
