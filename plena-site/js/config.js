/* CONFIGURAÇÃO DE ENVIO — único arquivo para configurar onde as inscrições vão.
   provider: "formspree" | "google" | "webhook" | "none"
   - formspree: endpoint = "https://formspree.io/f/SEU_ID"
   - webhook:   endpoint = URL que recebe POST JSON (Make, Zapier, n8n, Apps Script)
   - google:    endpoint = URL "formResponse" do Google Forms + campos em googleCampos
   - none:      não envia (modo teste; só mostra a confirmação) */
window.PLENA_ENVIO = {
  provider: "none",
  endpoint: "",
  googleCampos: { nome: "entry.0000000001", whatsapp: "entry.0000000002", email: "entry.0000000003", origem: "entry.0000000004" }
};
