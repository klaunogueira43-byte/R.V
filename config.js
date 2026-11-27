/* CONFIGURAÇÃO: conexão com o Supabase e textos padrão.
   A chave abaixo é a chave PÚBLICA (publishable). Pode ficar no site: quem protege os dados
   são as regras (RLS) do banco. Nunca coloque aqui a chave "service_role" / "secret". */
const SUPABASE_URL='https://ubletpqvadjfevmtzsxc.supabase.co';
const SUPABASE_KEY='sb_publishable_Rb9UX8r96COCYpEJSGy_MA_02cdRAIE';
const BUCKET='imoveis-fotos';

/* GOOGLE DRIVE (botão "Buscar do Google Drive" em Importar pasta).
   GOOGLE_CLIENT_ID: ID de cliente OAuth (tipo "Aplicativo da Web") criado no Google Cloud; é público, pode ficar aqui.
   Passo a passo no LEIA-ME.txt. DRIVE_PASTA_ID: pasta que já vem preenchida (a "Thais Vital Imob - Produtos"). */
const GOOGLE_CLIENT_ID='';
const DRIVE_PASTA_ID='1-IYvZ-YxtzzCEE0nyY9f9rK1NlBKhW60';

/* Textos usados só enquanto o banco carrega (o valor real vem da tabela site_config). */
const CFG0={marca:'R.V',titulo:'Encontre seu próximo apartamento',sub:'Veja fotos, valores e detalhes de cada imóvel. Gostou de algum? Chame o corretor direto pelo WhatsApp.',rodape:'Valores e disponibilidade sujeitos a alteração. Fale com o corretor para confirmar.',cor:'#0f6b8f',zap:'Olá! Vi o imóvel "{titulo}" ({bairro}) por {preco} e gostaria de mais informações.'};
