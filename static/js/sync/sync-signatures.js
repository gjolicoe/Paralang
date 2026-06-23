function getSyncSignatureFromElement(element) {
    if (!element) return "none";

    const tag = element.tagName.toLowerCase();

    // Treat heading level differences as equivalent for sync.
    // h2 vs h3 should not create an offset.
    if (/^h[1-6]$/.test(tag)) {
        return "h";
    }

    if (tag === "li") {
        const directNestedLists = Array.from(element.children).filter(child => {
            const childTag = child.tagName ? child.tagName.toLowerCase() : "";
            return childTag === "ul" || childTag === "ol";
        });

        if (!directNestedLists.length) {
            return "li";
        }

        const nestedListTypes = directNestedLists
            .map(list => list.tagName.toLowerCase())
            .join("+");

        const nestedItemCount = directNestedLists.reduce((count, list) => {
            return count + Array.from(list.children).filter(child => {
                return child.tagName && child.tagName.toLowerCase() === "li";
            }).length;
        }, 0);

        return `li:${nestedListTypes}:${nestedItemCount}`;
    }

    if (tag === "dt") {
        return "dt";
    }

    if (tag === "dd") {
        return "dd";
    }

    if (tag === "tr") {
        return "tr";
    }

    if (tag === "figure") {
        return "figure";
    }

    if (tag === "img") {
        return "img";
    }

    return tag;
}