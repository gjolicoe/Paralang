(() => {
  "use strict";

  const STORAGE_KEY = "paralangUiLanguage";
  const supported = new Set(["en", "fr"]);
  const stored = (() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  })();
  const language = supported.has(stored) ? stored : "en";

  const fr = {
    "Enable dark mode": "Activer le mode sombre",
    "Enable light mode": "Activer le mode clair",
    "Environment": "Environnement",
    "Content": "Contenu",
    "Paste HTML": "Coller HTML",
    "Folder": "Dossier",
    "EN page": "Page EN",
    "FR page": "Page FR",
    "EN Canada.ca URL": "URL Canada.ca EN",
    "FR Canada.ca URL": "URL Canada.ca FR",
    "Paste EN Canada.ca URL": "Coller l’URL Canada.ca EN",
    "Paste FR Canada.ca URL": "Coller l’URL Canada.ca FR",
    "Load": "Afficher",
    "Workspace": "Espace de travail",
    "Workspace ▾": "Espace de travail ▾",
    "Sources": "Sources",
    "Manage environments": "Gérer les environnements",
    "View": "Affichage",
    "Structure maps": "Structure des pages",
    "Issues panel": "Panneau des problèmes",
    "Single view": "Vue unique",
    "Dual view": "Vue côte à côte",
    "Code view": "Vue du code",
    "Reset workspace layout": "Réinitialiser la disposition",
    "Environment presets": "Préréglages d’environnement",
    "Configure reusable content sources and share them with your team.": "Configurez des sources de contenu réutilisables et partagez-les avec votre équipe.",
    "Close environment presets": "Fermer les préréglages d’environnement",
    "Saved presets": "Préréglages enregistrés",
    "Import JSON": "Importer un fichier JSON",
    "Export": "Exporter",
    "Delete": "Supprimer",
    "No team presets yet": "Aucun préréglage d’équipe",
    "Create one below or import a JSON preset from your team.": "Créez-en un ci-dessous ou importez un préréglage JSON de votre équipe.",
    "Create a preset": "Créer un préréglage",
    "Connect Paralang to a local or shared folder structure.": "Connectez Paralang à une structure de dossiers locale ou partagée.",
    "Name": "Nom",
    "Department website": "Site Web du ministère",
    "Preset ID": "Identifiant du préréglage",
    "Lowercase letters, numbers, and hyphens.": "Lettres minuscules, chiffres et traits d’union.",
    "Group": "Groupe",
    "Team presets": "Préréglages d’équipe",
    "Used as a header in the Environment menu.": "Utilisé comme en-tête dans le menu Environnement.",
    "Root folder": "Dossier racine",
    "Folder layout": "Disposition des dossiers",
    "Named subfolders": "Sous-dossiers nommés",
    "Pages directly in root": "Pages directement à la racine",
    "Content selector": "Sélecteur de contenu",
    "CSS selector for the primary page content.": "Sélecteur CSS du contenu principal de la page.",
    "Detect files in each root": "Détecter les fichiers dans chaque racine",
    "Include HTML files directly inside the selected folder.": "Inclure les fichiers HTML directement dans le dossier sélectionné.",
    "Detect additional folders": "Détecter des dossiers supplémentaires",
    "Search one or more relative subfolder paths.": "Rechercher un ou plusieurs chemins de sous-dossiers relatifs.",
    "Additional folder paths": "Chemins de dossiers supplémentaires",
    "+ Add folder": "+ Ajouter un dossier",
    "Additional folder path": "Chemin du dossier supplémentaire",
    "Remove folder": "Supprimer le dossier",
    "Remove": "Supprimer",
    "Enter paths relative to each root. Nested paths such as": "Entrez des chemins relatifs à chaque racine. Les chemins imbriqués comme",
    "are supported.": "sont pris en charge.",
    "Enter paths relative to each root. Nested paths such as campaign/pages are supported.": "Entrez des chemins relatifs à chaque racine. Les chemins imbriqués comme campaign/pages sont pris en charge.",
    "Reset": "Réinitialiser",
    "Create preset": "Créer le préréglage",
    "Send feedback": "Envoyer des commentaires",
    "Tell us what happened in your own words. No technical details needed.": "Expliquez-nous ce qui s’est passé dans vos propres mots. Aucun détail technique n’est requis.",
    "Close feedback form": "Fermer le formulaire de commentaires",
    "What would you like to tell us?": "Qu’aimeriez-vous nous dire?",
    "Something didn't work": "Quelque chose n’a pas fonctionné",
    "Report unexpected behaviour or an error.": "Signalez un comportement inattendu ou une erreur.",
    "Something was confusing": "Quelque chose prêtait à confusion",
    "Tell us what was unclear or difficult.": "Dites-nous ce qui n’était pas clair ou ce qui était difficile.",
    "I have a suggestion": "J’ai une suggestion",
    "Share an idea that could improve Paralang.": "Proposez une idée qui pourrait améliorer Paralang.",
    "Something else": "Autre chose",
    "Send a comment, question, or other feedback.": "Envoyez-nous un commentaire, une question ou toute autre rétroaction.",
    "What were you trying to do?": "Qu’essayiez-vous de faire?",
    "Briefly describe what you were doing.": "Décrivez brièvement ce que vous faisiez.",
    "What happened instead?": "Que s’est-il passé plutôt?",
    "Tell us what went wrong. You can add a screenshot in Outlook.": "Dites-nous ce qui s’est mal passé. Vous pourrez ajouter une capture d’écran dans Outlook.",
    "We'll prepare the email for you.": "Nous préparerons le courriel pour vous.",
    "Outlook will open with your answers filled in. Review the message, add a screenshot if helpful, and select Send.": "Outlook s’ouvrira avec vos réponses. Relisez le message, ajoutez une capture d’écran au besoin, puis sélectionnez Envoyer.",
    "Cancel": "Annuler",
    "Continue to Outlook": "Continuer dans Outlook",
    "Paste English and French HTML": "Coller le HTML anglais et français",
    "Paste both complete HTML documents, then save them to begin the comparison.": "Collez les deux documents HTML complets, puis enregistrez-les pour lancer la comparaison.",
    "English HTML": "HTML anglais",
    "French HTML": "HTML français",
    "English pages": "Pages anglaises",
    "French pages": "Pages françaises",
    "Paste English HTML here...": "Collez le HTML anglais ici…",
    "Paste French HTML here...": "Collez le HTML français ici…",
    "Save location": "Emplacement d’enregistrement",
    "Temporary cache": "Cache temporaire",
    "Use for short-term review.": "Pour une révision à court terme.",
    "Local files": "Fichiers locaux",
    "Keep for longer-term work.": "Pour un travail à plus long terme.",
    "Temporary content is deleted after 14 days.": "Le contenu temporaire est supprimé après 14 jours.",
    "Files saved to Local files are kept until you remove them.": "Les fichiers enregistrés dans Fichiers locaux sont conservés jusqu’à ce que vous les supprimiez.",
    "Save and review": "Enregistrer et réviser",
    "Similar pasted HTML found": "Contenu HTML similaire trouvé",
    "Choose what to do with each existing file before continuing.": "Choisissez quoi faire avec chaque fichier existant avant de continuer.",
    "Cancel submission": "Annuler l’envoi",
    "Continue": "Continuer",
    "View controls": "Commandes d’affichage",
    "Focus mode": "Mode focus",
    "Exit focus mode": "Quitter focus",
    "Exit focus": "Quitter focus",
    "Hide outline": "Masquer contour",
    "Show outline": "Afficher contour",
    "Auto-sync off": "Auto-sync non",
    "Auto-sync on": "Auto-sync oui",
    "Reset sync": "Réinit. sync",
    "Loading view...": "Chargement de la vue…",
    "Loading page view...": "Chargement de la vue de page…",
    "Left structure": "Structure de gauche",
    "Right structure": "Structure de droite",
    "Choose or paste an EN page and press Load.": "Choisissez ou collez une page EN, puis sélectionnez Afficher.",
    "Choose or paste a FR page and press Load.": "Choisissez ou collez une page FR, puis sélectionnez Afficher.",
    "Drag to resize code panel. Double-click to expand or collapse.": "Faites glisser pour redimensionner le panneau de code. Double-cliquez pour le développer ou le réduire.",
    "Drag to resize. Double-click to expand or collapse.": "Faites glisser pour redimensionner. Double-cliquez pour développer ou réduire.",
    "Loading code section...": "Chargement de la section de code…",
    "Issues -": "Problèmes -",
    "automated,": "automatisés,",
    "user-marked": "signalés par l’utilisateur",
    "Change name": "Changer le nom",
    "Re-run automated check": "Relancer la vérification automatisée",
    "Create new issue": "Créer un problème",
    "User": "Utilisateur",
    "Auto": "Auto",
    "Status:": "État :",
    "By:": "Par :",
    "Mark fixed": "Marquer comme réglé",
    "open": "ouvert",
    "fixed": "réglé",
    "No issues found.": "Aucun problème trouvé.",
    "Content not found": "Contenu introuvable",
    "No content container was found.": "Aucun conteneur de contenu n’a été trouvé.",
    "Code view": "Vue du code",
    "No code view available.": "Aucune vue du code disponible.",
    "No left code view available.": "Aucune vue du code de gauche disponible.",
    "No right code view available.": "Aucune vue du code de droite disponible.",
    "Choose or paste a valid page and press Load.": "Choisissez ou collez une page valide, puis sélectionnez Afficher.",
    "Choose or paste a valid EN page and press Load.": "Choisissez ou collez une page EN valide, puis sélectionnez Afficher.",
    "Choose or paste a valid FR page and press Load.": "Choisissez ou collez une page FR valide, puis sélectionnez Afficher.",
    "Canada.ca URL": "URL Canada.ca",
    "Page": "Page",
    "Paste Canada.ca URL": "Coller l’URL Canada.ca",
    "Showing H2 sections": "Affichage des sections H2",
    "since the html file is over 10,000 lines.": "puisque le fichier HTML compte plus de 10 000 lignes.",
    "No .content-area or <main> found in this file.": "Aucun élément .content-area ou <main> n’a été trouvé dans ce fichier.",
    "Enter your name for QA notes:": "Entrez votre nom pour les notes d’AQ :",
    "No selected block found.": "Aucun bloc n’est sélectionné.",
    "Issue title:": "Titre du problème :",
    "Review this block": "Réviser ce bloc",
    "Comment:": "Commentaire :",
    "Could not create issue.": "Impossible de créer le problème.",
    "Remove this issue from the issue panel?": "Retirer ce problème du panneau des problèmes?",
    "Could not remove issue.": "Impossible de retirer le problème.",
    "Could not re-run automated issue check.": "Impossible de relancer la vérification automatisée.",
    "Re-run the automated issue check? This will replace existing automated issues for this page pair.": "Relancer la vérification automatisée? Les problèmes automatisés existants de cette paire de pages seront remplacés.",
    "Could not save the preset.": "Impossible d’enregistrer le préréglage.",
    "Could not delete the preset.": "Impossible de supprimer le préréglage.",
    "The selected file is not valid JSON.": "Le fichier sélectionné n’est pas au format JSON valide.",
    "The pasted HTML could not be saved.": "Impossible d’enregistrer le HTML collé.",
    "Overwrite existing": "Écraser le fichier existant",
    "Replace the existing file with this pasted content.": "Remplacer le fichier existant par ce contenu collé.",
    "Create new copy": "Créer une nouvelle copie",
    "Keep the existing file and save a numbered copy.": "Conserver le fichier existant et enregistrer une copie numérotée.",
    "Both English and French HTML are required.": "Les contenus HTML anglais et français sont requis.",
    "Invalid save location.": "Emplacement d’enregistrement invalide.",
    "Invalid duplicate action.": "Action sur le doublon invalide.",
    "Preset not found or cannot be deleted.": "Préréglage introuvable ou impossible à supprimer.",
    "Issue not found.": "Problème introuvable.",
    "Missing required page pair information.": "Les renseignements requis sur la paire de pages sont manquants.",
    "Automated issue tracking is disabled for URL-based environments.": "Le suivi automatisé des problèmes est désactivé pour les environnements avec URL.",
    "Table number mismatch": "Non-concordance des nombres du tableau",
    "Extra block on right": "Bloc supplémentaire à droite",
    "Extra block on left": "Bloc supplémentaire à gauche",
    "Structure mismatch": "Non-concordance de structure",
    "Identical text": "Texte identique",
    "Length mismatch": "Non-concordance de longueur",
    "Possible mismatch": "Non-concordance possible",
    "Missing section": "Section manquante",
    "Heading level mismatch": "Non-concordance de niveau de titre",
    "Automated issue": "Problème automatisé",
    "Automated check": "Vérification automatisée",
    "Local files": "Fichiers locaux",
    "Pasted HTML": "HTML collé",
    "Built-in environments": "Environnements intégrés"
  };

  Object.assign(fr, {
    "Tell us what you wanted to accomplish.": "Dites-nous ce que vous vouliez accomplir.",
    "What was unclear?": "Qu’est-ce qui n’était pas clair?",
    "Which instruction, button, or part of the screen was confusing?": "Quelle instruction, quel bouton ou quelle partie de l’écran prêtait à confusion?",
    "What would you like Paralang to do?": "Que souhaiteriez-vous que Paralang fasse?",
    "Describe your idea in your own words.": "Décrivez votre idée dans vos propres mots.",
    "How would this help you? (optional)": "En quoi cela vous aiderait-il? (facultatif)",
    "Tell us when or why you would use it.": "Dites-nous quand ou pourquoi vous l’utiliseriez.",
    "Add any comments or feedback here.": "Ajoutez vos commentaires ou toute autre rétroaction ici.",
    "Not available": "Non disponible",
    "Hello,": "Bonjour,",
    "Feedback type:": "Type de rétroaction :",
    "--- Automatically added by Paralang ---": "--- Ajouté automatiquement par Paralang ---",
    "Paralang version:": "Version de Paralang :",
    "Computer platform:": "Plateforme informatique :",
    "Date and time:": "Date et heure :",
    "Report ID:": "ID du rapport :",
    "You can attach a screenshot to this email if it would help explain the report.": "Vous pouvez joindre une capture d’écran à ce courriel si elle aide à expliquer le problème.",
    "A preset must be a JSON object.": "Le préréglage doit être un objet JSON.",
    "Preset ID must use lowercase letters, numbers, and hyphens.": "L’identifiant du préréglage doit contenir des lettres minuscules, des chiffres et des traits d’union.",
    "That preset ID is reserved by Paralang.": "Cet identifiant est réservé par Paralang.",
    "Preset name is required and must be 80 characters or fewer.": "Le nom du préréglage est obligatoire et doit contenir au plus 80 caractères.",
    "Root must be an absolute local or network folder path.": "La racine doit être un chemin absolu vers un dossier local ou réseau.",
    "Collection mode must be named-folders or direct.": "Le mode de collection doit être named-folders ou direct.",
    "Preset group or content selector is invalid.": "Le groupe du préréglage ou le sélecteur de contenu est invalide.",
    "Additional folders must be a list containing no more than 20 paths.": "Les dossiers supplémentaires doivent former une liste d’au plus 20 chemins.",
    "Each additional folder must be a safe relative path within the root.": "Chaque dossier supplémentaire doit être un chemin relatif valide sous le dossier racine.",
    "A preset with that ID already exists.": "Un préréglage avec cet identifiant existe déjà.",
    "Only https://www.canada.ca/en/... and https://www.canada.ca/fr/... URLs are allowed.": "Seules les URL https://www.canada.ca/en/... et https://www.canada.ca/fr/... sont autorisées.",
    "Unsupported language": "Langue non prise en charge",
    "Invalid cached filename": "Nom de fichier en cache invalide",
    "The cached file to overwrite no longer exists.": "Le fichier en cache à écraser n’existe plus."
  });

  const patterns = [
    [/^(\d+) team presets? available$/, (_, n) => `${n} préréglage${n === "1" ? "" : "s"} d’équipe disponible${n === "1" ? "" : "s"}`],
    [/^(\d+) elements$/, "$1 éléments"],
    [/^(\d+) headings$/, "$1 titres"],
    [/^Refresh in (\d+)s$/, "Actualisation dans $1 s"],
    [/^Reviewer name updated to: (.+)$/, "Nom de la personne responsable mis à jour : $1"],
    [/^Delete the (.+) environment preset\?$/, "Supprimer le préréglage d’environnement $1?"],
    [/^A (identical|similar) file already exists: (.+)$/, (_, kind, file) => `Un fichier ${kind === "identical" ? "identique" : "similaire"} existe déjà : ${file}`],
    [/^Missing required fields: (.+)$/, "Champs obligatoires manquants : $1"],
    [/^Table values differ: English (.+); French (.+)\.$/, "Les valeurs du tableau diffèrent : anglais $1; français $2."],
    [/^Left is (.+); right is (.+)\.$/, "À gauche : $1; à droite : $2."],
    [/^Text length differs significantly: left (\d+) characters, right (\d+) characters\.$/, "La longueur du texte diffère considérablement : $1 caractères à gauche et $2 à droite."],
    [/^Left heading is (H\d); right heading is (H\d)\.$/, "Le titre de gauche est $1; celui de droite est $2."],
    [/^Sync ([+-]\d+)$/, "Sync $1"],
    [/^Status: (.+)$/, (_, status) => `État : ${translateText(status)}`],
    [/^of (\d+)$/, "sur $1"],
    [/^Reset sync \(([+-]?\d+)\)$/, "Réinit. sync ($1)"],
    [/^Folder name pattern is invalid: (.+)$/, "Le modèle de nom de dossier est invalide : $1"],
    [/^The (EN|FR) HTML field is empty\.$/, "Le champ HTML $1 est vide."]
  ];

  Object.assign(fr, {
    "The French page has a comparable block that does not align with the English page.": "La page française contient un bloc comparable qui ne correspond pas à la page anglaise.",
    "The English page has a comparable block that does not align with the French page.": "La page anglaise contient un bloc comparable qui ne correspond pas à la page française.",
    "Both sides contain identical text. This may be valid, but it can also indicate untranslated content.": "Les deux côtés contiennent un texte identique. Cela peut être valide, mais peut aussi indiquer du contenu non traduit.",
    "These blocks were aligned by the diff engine but may need review.": "Ces blocs ont été alignés par le moteur de comparaison, mais pourraient nécessiter une révision.",
    "A section exists on one side but not the other.": "Une section existe d’un côté, mais pas de l’autre."
  });

  function translateText(value) {
    if (language !== "fr" || typeof value !== "string") return value;
    if (Object.prototype.hasOwnProperty.call(fr, value)) return fr[value];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(value)) return value.replace(pattern, replacement);
    }
    return value;
  }

  function translateTextNode(node) {
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed) return;
    const translated = translateText(trimmed);
    if (translated !== trimmed) node.nodeValue = original.replace(trimmed, translated);
  }

  function translateElement(root) {
    if (language !== "fr" || !root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && root.matches("script, style, code, pre, [data-i18n-skip]")) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest("script, style, code, pre, [data-i18n-skip]")
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) translateTextNode(walker.currentNode);
    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll("*")] : root.querySelectorAll("*");
    for (const element of elements) {
      if (element.closest("[data-i18n-skip]")) continue;
      for (const attribute of ["aria-label", "title", "placeholder", "label"]) {
        if (!element.hasAttribute(attribute)) continue;
        const original = element.getAttribute(attribute);
        const translated = translateText(original);
        if (translated !== original) element.setAttribute(attribute, translated);
      }
      if (element.hasAttribute("data-i18n-value")) element.value = translateText(element.value);
    }
  }

  function setLanguage(next) {
    if (!supported.has(next)) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* preferences are optional */ }
    window.location.reload();
  }

  document.documentElement.lang = language;
  window.PARALANG_UI_LANGUAGE = language;
  window.ParalangI18n = { language, translateText, translateElement, setLanguage };

  const nativeAlert = window.alert.bind(window);
  const nativeConfirm = window.confirm.bind(window);
  const nativePrompt = window.prompt.bind(window);
  window.alert = message => nativeAlert(translateText(String(message)));
  window.confirm = message => nativeConfirm(translateText(String(message)));
  window.prompt = (message, defaultValue) => nativePrompt(translateText(String(message)), defaultValue);

  document.addEventListener("DOMContentLoaded", () => {
    translateElement(document);
    const toggle = document.getElementById("toggleLanguage");
    if (toggle) {
      toggle.textContent = language.toUpperCase();
      toggle.setAttribute("aria-label", language === "en" ? "Passer à l’interface française" : "Switch to the English interface");
      toggle.title = toggle.getAttribute("aria-label");
      toggle.addEventListener("click", () => setLanguage(language === "en" ? "fr" : "en"));
    }
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) translateElement(node);
        if (record.type === "characterData") translateElement(record.target);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "placeholder", "label"]
    });
  });
})();
