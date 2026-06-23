const root = document.documentElement;

const storageKey = "paralangLayoutVars";
const mapsHiddenKey = "paralangMapsHidden";
const diffHeightKey = "paralangDiffHeight";
const diffHiddenKey = "paralangDiffHidden";
const singleViewKey = "paralangSingleView";
const darkModeKey = "paralangDarkMode";
const codeViewKey = "paralangCodeView";
const codePanelKey = "paralangCodePanelVisible";
const codeHeightKey = "paralangCodePanelHeight";

const preflightIssues = window.PARALANG_PREFLIGHT_ISSUES || [];
const allPageFiles = window.PARALANG_ALL_FILES || [];
const enPageFiles = window.PARALANG_EN_FILES || [];
const frPageFiles = window.PARALANG_FR_FILES || [];
const sourceOptions = window.PARALANG_SOURCE_OPTIONS || [];

const isUrlInputEnvironment = window.PARALANG_IS_URL_INPUT || false;

let singleViewEnabled = false;
let autoSyncEnabled = false;
let manualRightSyncOffset = 0;
let theoreticalRightSyncOffset = 0;
let selectedElementIndex = 0;
let focusModeEnabled = false;
let highlightModeEnabled = true;
let codeViewEnabled = false;
let viewIsLoading = false;
let loaded = 0;
let lastScrollTime = 0;
let codePanelEnabled = false;
let isSyncingDetails = false;
let pendingCodePanelSync = false;
let codeManualScrollMode = false;
let isOpeningDetailsForIssueNavigation = false;
let lastAutoSyncedRightIndex = 0;
let codeWindowManualBrowsing = false;

const defaults = {
  leftMapWidth: 260,
  leftPageRatio: 1,
  rightPageRatio: 1,
  rightMapWidth: 260,
  diffHeight: 180
};

const snapSelector = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p",
  "li",
  "table",
  "tr",
  "figure",
  "img"
].join(",");

const leftFrame = document.getElementById("leftFrame");
const rightFrame = document.getElementById("rightFrame");
const leftSelect = document.getElementById("left");
const rightSelect = document.getElementById("right");
const envSelect = document.getElementById("env");
const yearSelect = document.getElementById("year");
const leftCodeFrame = document.getElementById("leftCodeFrame");
const rightCodeFrame = document.getElementById("rightCodeFrame");