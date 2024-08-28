document.addEventListener("DOMContentLoaded", function () {
    // Function to break text into paragraphs after a certain number of words
    function breakTextIntoParagraphs(selector, wordsPerParagraph) {
        const elements = document.querySelectorAll(selector);

        elements.forEach((element) => {
            const text = element.innerText;
            const words = text.split(" ");
            const paragraphs = [];

            for (let i = 0; i < words.length; i += wordsPerParagraph) {
                const paragraph = words.slice(i, i + wordsPerParagraph).join(" ");
                paragraphs.push(paragraph);
            }

            element.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join("");
        });
    }

    // Break text in elements with class "dynamic-text" after every 50 words
    breakTextIntoParagraphs(".dynamic-text", 25);
});
