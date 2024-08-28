document.addEventListener("DOMContentLoaded", function () {
    const content = {
        header: {
            title: "Welcome to Evan's Website"
        },
        personalDetails: {
            name: "Evan Sthapit",
            profession: "Platform Engineer",
            address: "Berlin, Germany",
            linkedinUrl: "https://www.linkedin.com/in/evan-sthapit/", 
            imageUrl: "assets/evan.jpeg"
        },
        sections: [
            {
                id: "introduction",
                title: "About Me",
                paragraphs: [
                    "As a working student on the Platform Engineering team since 2023. I'm passionate about learning and growing both professionally and personally.",
                    "In engineering, I design and optimize software systems, leveraging my knowledge of programming languages and tools to create efficient and scalable solutions.",
                    "I'm driven by a love for continuous learning, embracing new challenges and technologies with enthusiasm."
                ]
            },
            {
                id: "languages",
                title: "Languages",
                paragraphs: [
                    "I am fluent in English, German, Nepali, and Newari. I am also proficient in Urdu and have very basic knowledge of Russian. I enjoy learning new languages and exploring different cultures."
                ]
            },
            {
                id: "skills",
                title: "Technical Skills",
                skills: [
                    "Git, GitHub and Github Actions",
                    "Python",
                    "Golang",
                    "Scripting",
                    "Terraform",
                    "Amazon Web Services (AWS)",
                    "Kubernetes",
                    "Docker"
                ]
            },
            {
                id: "experience",
                title: "Professional Experience",
                paragraphs: [
                    "I am currently working as a Platform Engineer since the beginning of 2023 and finishing my Bachelor's Degree in the Field of Computer Engineering. I am a team player and have been involved in various projects at Onefootball."
                ]
            }
        ],
        footer: {
            text: "© Evan's Personal Website, Last Updated: 28.08.2024"
        }
    };

    const headerElement = document.getElementById("header");
    headerElement.innerHTML = `<h1>${content.header.title}</h1>`;

    const mainContent = document.getElementById("main-content");

    // Profile and personal details container
    const profileContainer = document.createElement("div");
    profileContainer.className = "profile-container";

    const detailsDiv = document.createElement("div");
    detailsDiv.innerHTML = `<h2>${content.personalDetails.name}</h2>
                            <p>Profession: ${content.personalDetails.profession}</p>
                            <p>Address: ${content.personalDetails.address}</p>
                            <p><a href="${content.personalDetails.linkedinUrl}" target="_blank">LinkedIn Profile</a></p>`;

    const profileImage = document.createElement("img");
    profileImage.src = content.personalDetails.imageUrl;
    profileImage.alt = "Profile image of Evan";
    profileImage.className = "profile-image";

    profileContainer.appendChild(detailsDiv);
    profileContainer.appendChild(profileImage);
    mainContent.appendChild(profileContainer);

    // Flex containers for top and bottom sections
    const topFlexContainer = document.createElement("div");
    topFlexContainer.className = "flex-container";
    const bottomFlexContainer = document.createElement("div");
    bottomFlexContainer.className = "flex-container";

    content.sections.forEach(section => {
        const sectionElement = document.createElement("section");
        sectionElement.className = "flex-item";
        sectionElement.id = section.id;

        const titleElement = document.createElement("h2");
        titleElement.textContent = section.title;
        sectionElement.appendChild(titleElement);

        if (section.paragraphs) {
            section.paragraphs.forEach(paragraph => {
                const p = document.createElement("p");
                p.textContent = paragraph;
                sectionElement.appendChild(p);
            });
        }

        if (section.skills) {
            const ul = document.createElement("ul");
            section.skills.forEach(skill => {
                const li = document.createElement("li");
                li.textContent = skill;
                ul.appendChild(li);
            });
            sectionElement.appendChild(ul);
        }

        // Assign sections to the correct container based on the ID
        if (["introduction", "skills"].includes(section.id)) {
            topFlexContainer.appendChild(sectionElement);
        } else if (["experience", "languages"].includes(section.id)) {
            bottomFlexContainer.appendChild(sectionElement);
        }
    });

    mainContent.appendChild(topFlexContainer);
    mainContent.appendChild(bottomFlexContainer);

    const footerElement = document.getElementById("footer");
    footerElement.innerHTML = `<p>${content.footer.text}</p>`;
});
