function getSelectedEnv() {
    return document.getElementById("env").value;
}

function getSelectedYear() {
    return document.getElementById("year").value;
}

function rebuildYearDropdown() {
  if (getSelectedEnv() === "aem-sensitive") return;

  const selectedEnv = envSelect.value;
  const matchingSource = sourceOptions.find(source => source.key === selectedEnv);

  yearSelect.innerHTML = "";

  if (!matchingSource) return;

  matchingSource.years.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });
}

function getPairedFilename(filename, fromSuffix, toSuffix) {
    if (!filename.endsWith(fromSuffix)) return "";
    return filename.slice(0, -fromSuffix.length) + toSuffix;
}

function rebuildLeftDropdownForDualView() {
  if (getSelectedEnv() === "aem-sensitive") return;

  const currentValue = leftSelect.value;

  leftSelect.innerHTML = "";

  enPageFiles.forEach(file => {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = getDisplayFilename(file);
    option.dataset.lang = "en";
    leftSelect.appendChild(option);
  });

  if (!selectOptionIfExists(leftSelect, currentValue)) {
    selectOptionIfExists(leftSelect, enPageFiles[0] || "");
  }
}

function rebuildLeftDropdownForSingleView() {
  if (getSelectedEnv() === "aem-sensitive") return;

  const currentValue = leftSelect.value;

  leftSelect.innerHTML = "";

  const enGroup = document.createElement("optgroup");
  enGroup.label = "English pages";

  enPageFiles.forEach(file => {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = getDisplayFilename(file);
    option.dataset.lang = "en";
    enGroup.appendChild(option);
  });

  const frGroup = document.createElement("optgroup");
  frGroup.label = "French pages";

  frPageFiles.forEach(file => {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = getDisplayFilename(file);
    option.dataset.lang = "fr";
    frGroup.appendChild(option);
  });

  leftSelect.appendChild(enGroup);
  leftSelect.appendChild(frGroup);

  if (!selectOptionIfExists(leftSelect, currentValue)) {
    selectOptionIfExists(leftSelect, enPageFiles[0] || frPageFiles[0] || "");
  }
}

function selectOptionIfExists(select, value) {
  if (!select || !select.options) return false;

  const option = Array.from(select.options).find(opt => opt.value === value);

  if (option) {
    select.value = value;
    return true;
  }

  return false;
}

function getDisplayFilename(file) {
  return String(file || "").replace(/^report-rapport\//, "");
}