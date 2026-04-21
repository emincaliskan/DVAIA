(async function init() {
  const session = await getSession();
  updateSessionUI(session);
  if (!document.querySelector("#main_body .panel.active")) showPanel("direct");
  loadDocuments();
  loadExperimentsList();
})();
