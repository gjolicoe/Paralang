function getPrimaryContentContainer(doc) {
    return doc.querySelector(".paralang-content-scope")
        || doc.querySelector(".content-area")
        || doc.querySelector("main");
}

function getComparableElements(frame) {
    const doc = frame.contentDocument || frame.contentWindow.document;

    if (!doc || !doc.body) return [];

    const contentArea = getPrimaryContentContainer(doc);

    if (!contentArea) return [];

    return Array.from(
        contentArea.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, dt, dd, tr, figure, img")
    ).filter(element => {
        const tag = element.tagName.toLowerCase();

        const detailsParent = element.closest("details");

        if (detailsParent && !detailsParent.open) {
            return false;
        }

        if (element.closest("li") && tag !== "li") {
            return false;
        }

        if (element.closest("dl") && tag !== "dt" && tag !== "dd") {
            return false;
        }

        if (element.closest("table") && tag !== "tr") {
            return false;
        }

        const text = element.textContent.trim();
        const isVisual = tag === "figure" || tag === "img";

        return isVisual || Boolean(text);
    });
}

function getComparableElementsForDocument(contentArea) {
    return Array.from(contentArea.querySelectorAll(snapSelector)).filter(el => {
        const tag = el.tagName.toLowerCase();

        const detailsParent = el.closest("details");
        if (detailsParent && !detailsParent.hasAttribute("open")) {
            return false;
        }

        if (["strong", "em", "span", "a"].includes(tag)) {
            return false;
        }

        if (el.closest("li") && tag !== "li") {
            return false;
        }

        if (el.closest("table")) {
            return tag === "tr";
        }

        const text = el.innerText ? el.innerText.trim() : "";
        const isVisual = ["figure", "img"].includes(tag);

        return isVisual || text.length > 0;
    });
}

function getSignatureFromElement(el) {
    if (!el) return "none";

    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
        return tag;
    }

    if (tag === "tr") {
        const cells = el.querySelectorAll(":scope > th, :scope > td").length;
        const headers = el.querySelectorAll(":scope > th").length;
        return `tr:${cells}:${headers}`;
    }

    if (tag === "img") {
        const hasSrc = el.hasAttribute("src") && el.getAttribute("src").trim() !== "";
        const hasAlt = el.hasAttribute("alt") && el.getAttribute("alt").trim() !== "";
        return `img:${hasSrc}:${hasAlt}`;
    }

    if (tag === "figure") {
        const imgCount = el.querySelectorAll("img").length;
        const captionCount = el.querySelectorAll("figcaption").length;
        return `figure:${imgCount}:${captionCount}`;
    }

    return tag;
}

function areCurrentBlocksOutOfSync(leftIndex, rightIndex) {
    const leftElements = getComparableElementsCached(leftFrame);
    const rightElements = getComparableElementsCached(rightFrame);

    const leftEl = leftElements[leftIndex];
    const rightEl = rightElements[rightIndex];

    const leftSig = getSignatureFromElement(leftEl);
    const rightSig = getSignatureFromElement(rightEl);

    return leftSig !== rightSig;
}

function getComparableElementSignature(element) {
    if (!element) return "";

    const detailsParent = element.closest("details");

    if (detailsParent && !detailsParent.open) {
        return "";
    }

    const tag = element.tagName.toLowerCase();

    if (tag === "figure" || tag === "img") {
        const img = tag === "img" ? element : element.querySelector("img");

        const src = img ? (img.getAttribute("src") || "") : "";
        const alt = img ? (img.getAttribute("alt") || "") : "";

        return normalizeComparableSignature(`${tag}|${src}|${alt}`);
    }

    const text = (element.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);

    return normalizeComparableSignature(`${tag}|${text}`);
}

function getComparableSignatureForFrameIndex(frame, index) {
    const elements = getComparableElementsCached
        ? getComparableElementsCached(frame)
        : getComparableElements(frame);

    if (!elements.length) return "";

    const safeIndex = Math.max(0, Math.min(index, elements.length - 1));
    return getComparableElementSignature(elements[safeIndex]);
}