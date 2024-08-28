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
                    "Started as a Working Student on the IT Team from 2021-2023 and working on the Platform Engineering Team from 2023-present in Onefootball GmbH. I'm passionate about learning and growing both professionally and personally.",
                    "In engineering, I design and optimize software systems, leveraging my knowledge of programming languages and tools to create efficient and scalable solutions.",
                    "I'm driven by a love for continuous learning, embracing new challenges and technologies with enthusiasm. I am a great team player, consistently contributing positively to team dynamics and collaborative efforts."
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
                title: "Technical Skills and Knowledge",
                skills: [
                    "Git, GitHub and Github Actions",
                    "Python, Golang, C",
                    "Terraform",
                    "Amazon Web Services (AWS)",
                    "Kubernetes",
                    "Docker",
                    "Microsoft Word, Excel and Powerpoint",
                    "Digital Proficiency",
                    "Internet Competence"
                ]
            },
            {
                id: "experience",
                title: "Professional Experience",
                paragraphs: [
                    "I am currently working as a Platform Engineer since the beginning of 2023 and finishing my Bachelor's Degree in the Field of Computer Engineering. I am a team player and have been involved in various projects at Onefootball."
                ]
            },
            {
                id: "projects",
                title: "Projects I have worked on",
                projects: [
                    "Codeowners Automation",
                    "Created Tests for our Terraform Modules",
                    "Updating Templating System for Helm-Chart-Generator",
                    "Migration for Honeycomb from US to EU Account",
                    "Upgrading Redis",
                    "Upgrading AWS Aurora RDS",
                    "Soundcheck(Spotify) in Backstage",
                    "Created Automated Documentation for tf-modules",
                    "Daily Maintenace in IAC-Repo and tf-modules"
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
                            <p><strong>Main Profession:</strong> ${content.personalDetails.profession}</p>
                            <p><strong>Address:</strong> ${content.personalDetails.address}</p>
                            <p><strong><a href="${content.personalDetails.linkedinUrl}" target="_blank">LinkedIn Profile</a></strong></p>`;

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
        
        if (section.projects) {
            const ul = document.createElement("ul");
            section.projects.forEach(skill => {
                const li = document.createElement("li");
                li.textContent = skill;
                ul.appendChild(li);
            });
            sectionElement.appendChild(ul);
        }

        // Assign sections to the correct container based on the ID
        if (["introduction", "skills", "projects"].includes(section.id)) {
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
