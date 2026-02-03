const rawToolsData = [
    {
        "name": "SakuraMind",
        "category": "Productivity",
        "description": "Build clean, intuitive mind maps instantly in your browser with drag-and-drop simplicity and dark mode support.",
        "url": "https://www.unsoft.jp/"
    },
    {
        "name": "MindMapFlow",
        "category": "Productivity",
        "description": "Instant mind-mapping that turns your ideas into clear visual diagrams in seconds.",
        "url": "https://mindmapflow.io/"
    },
    {
        "name": "Twiddla",
        "category": "Productivity",
        "description": "Live online whiteboard for visual collaboration, brainstorming, and real-time team discussions.",
        "url": "https://www.twiddla.com/"
    },
    {
        "name": "Math Whiteboard",
        "category": "Productivity",
        "description": "Interactive math whiteboard for writing equations, drawing graphs, and solving problems visually.",
        "url": "https://www.mathwhiteboard.com/"
    },
    {
        "name": "Whiteboard-Online",
        "category": "Productivity",
        "description": "Simple online whiteboard for drawing, sketching, and visual brainstorming directly in your browser.",
        "url": "https://whiteboard-online.org/"
    },
    {
        "name": "Whiteboard.chat",
        "category": "Productivity",
        "description": "Real-time online whiteboard for teaching, drawing, and collaborating live with others.",
        "url": "https://www.whiteboard.chat/"
    },
    {
        "name": "WooWhiteboard",
        "category": "Productivity",
        "description": "Instant, collaborative online whiteboard for drawing, teaching, and brainstorming in your browser.",
        "url": "https://woowhiteboard.com/"
    },
    {
        "name": "Eript",
        "category": "Media",
        "description": "The Zero-Friction, Privacy-First Teleprompter for Creators",
        "url": "https://eript.com/"
    },
    {
        "name": "Ziteboard",
        "category": "Productivity",
        "description": "Collaborate in real time on a clean, interactive online whiteboard for ideas and planning.",
        "url": "https://ziteboard.com/"
    },
    {
        "name": "tldraw",
        "category": "Productivity",
        "description": "Create, collaborate, and sketch ideas instantly on a versatile, browser-based whiteboard.",
        "url": "https://www.tldraw.com/"
    },
    {
        "name": "Whiteboard.team",
        "category": "Productivity",
        "description": "Collaborate in real time on an intuitive online whiteboard for brainstorming, planning, and teamwork.",
        "url": "https://www.whiteboard.team/"
    },
    {
        "name": "PDF Bob",
        "category": "Files",
        "description": "Edit, annotate, and manage your PDFs online with PDF Bob's simple, browser-based editor.",
        "url": "https://pdfbob.com/"
    },
    {
        "name": "LightPDF",
        "category": "Files",
        "description": "Easily edit, convert, merge, and split PDFs online with LightPDF's fast, intuitive tools.",
        "url": "https://lightpdf.com/"
    },
    {
        "name": "Sejda",
        "category": "Files",
        "description": "Edit, merge, compress, and convert PDFs instantly with Sejda's powerful and easy-to-use online tools.",
        "url": "https://www.sejda.com/"
    },
    {
        "name": "Batch Cropper",
        "category": "Images",
        "description": "Free Bulk Image Resizer - Process Hundreds of Images in Seconds",
        "url": "https://cropper.launchigniter.com"
    },
    {
        "name": "NaturalReaders",
        "category": "Language",
        "description": "Listen to text, documents, or webpages read aloud with natural voices for learning, work, or accessibility.",
        "url": "https://www.naturalreaders.com/"
    },
    {
        "name": "Speechma",
        "category": "Language",
        "description": "Turn text into realistic speech instantly with multiple voices and export options for videos, podcasts, or learning.",
        "url": "https://speechma.com/"
    },
    {
        "name": "Luvvoice",
        "category": "Language",
        "description": "Convert text into natural-sounding speech with multiple voices and languages for media, projects, or learning.",
        "url": "https://luvvoice.com/"
    },
    {
        "name": "Omni Calculator",
        "category": "Math & STEM",
        "description": "Solve thousands of everyday problems with instant, ready-to-use calculators across math, finance, health, and more.",
        "url": "https://www.omnicalculator.com/"
    },
    {
        "name": "QR Planet",
        "category": "Business",
        "description": "Create customizable QR codes instantly for links, files, and business needs with advanced tracking options.",
        "url": "https://qrplanet.com/"
    },
    {
        "name": "Bubbl.us",
        "category": "Productivity",
        "description": "Create colorful mind maps online to brainstorm, organize ideas, and share visually with ease.",
        "url": "https://bubbl.us/"
    },
    {
        "name": "Flask",
        "category": "Productivity",
        "description": "Lightweight note-taking tool with instant sharing, markdown support, and a clean distraction-free interface.",
        "url": "https://flask.io/"
    },
    {
        "name": "Mind Map Wizard",
        "category": "AI Tools",
        "description": "Generate instant AI-powered mind maps from any topic, text, or PDF for quick visual overviews and idea organization.",
        "url": "https://mindmapwizard.com/"
    },
    {
        "name": "Draw Chat",
        "category": "Design",
        "description": "Collaborate in real time with a shared online whiteboard, drawing tools, and video chat.",
        "url": "https://draw.chat/"
    },
    {
        "name": "Kleki",
        "category": "Design",
        "description": "Create digital drawings and paintings online with layers, brushes, and simple editing tools.",
        "url": "https://kleki.com/"
    },
    {
        "name": "Text to Speech",
        "category": "Language",
        "description": "Quickly convert any text into natural, high-quality speech with adjustable voices and speeds.",
        "url": "https://www.text-to-speech.online/"
    },
    {
        "name": "TTSMaker",
        "category": "Language",
        "description": "Convert text to natural-sounding speech instantly with customizable voices and formats.",
        "url": "https://ttsmaker.com/"
    },
    {
        "name": "Word Count",
        "category": "Writing",
        "description": "Instantly count words, characters, and paragraphs with a clean, easy-to-use online tool.",
        "url": "https://wordcount.com/"
    },
    {
        "name": "SellerFeesCalculator",
        "category": "Business",
        "description": "Quickly calculate seller fees and profits for online marketplaces with ease.",
        "url": "https://sellerfeescalculator.com/"
    },
    {
        "name": "Word Counter",
        "category": "Writing",
        "description": "Instantly count words, characters, and sentences with this easy-to-use online tool.",
        "url": "https://wordcounter.io/"
    },
    {
        "name": "EasyWordCount",
        "category": "Writing",
        "description": "Count words and characters instantly with this fast and simple online tool.",
        "url": "https://easywordcount.com/"
    },
    {
        "name": "Calculator.net",
        "category": "Math & STEM",
        "description": "Access a wide range of online calculators instantly for math, finance, health, and more.",
        "url": "https://www.calculator.net/"
    },
    {
        "name": "Barcode TEC-IT",
        "category": "Business",
        "description": "Generate custom barcodes online instantly for products, inventory, and personal projects.",
        "url": "https://barcode.tec-it.com/"
    },
    {
        "name": "QR Creator",
        "category": "Business",
        "description": "Generate professional QR codes instantly for URLs, text, emails, and social links with ease.",
        "url": "https://qr-creator.com/"
    },
    {
        "name": "QRCode Monkey",
        "category": "Business",
        "description": "Create high-quality, customizable QR codes instantly for websites, text, and social media links.",
        "url": "https://www.qrcode-monkey.com/"
    },
    {
        "name": "QRstuff",
        "category": "Business",
        "description": "Generate custom QR codes instantly for URLs, text, emails, and more with this easy online tool.",
        "url": "https://www.qrstuff.com/"
    },
    {
        "name": "Cheqmark",
        "category": "Productivity",
        "description": "Create and manage interactive checklists online instantly to stay organized and productive.",
        "url": "https://cheqmark.io/"
    },
    {
        "name": "MindMup",
        "category": "Productivity",
        "description": "Build interactive mind maps online quickly to organize ideas, plan projects, and brainstorm efficiently.",
        "url": "https://www.mindmup.com/"
    },
    {
        "name": "Simple MindMap",
        "category": "Productivity",
        "description": "Create clear and organized mind maps online instantly with this intuitive brainstorming tool.",
        "url": "https://simplemindmap.com/"
    },
    {
        "name": "ChartGo",
        "category": "Data Tools",
        "description": "Design custom charts and graphs online quickly with this simple and versatile chart builder.",
        "url": "https://www.chartgo.com/"
    },
    {
        "name": "LiveGap Charts",
        "category": "Data Tools",
        "description": "Create interactive charts and graphs instantly with this easy-to-use online chart builder.",
        "url": "https://charts.livegap.com/"
    },
    {
        "name": "Flowchart Fun",
        "category": "Design",
        "description": "Create clean, interactive flowcharts instantly using a simple, intuitive online tool.",
        "url": "https://flowchart.fun/"
    },
    {
        "name": "Venice",
        "category": "AI Tools",
        "description": "Generate AI-powered content, summaries, and insights instantly with this intelligent writing assistant.",
        "url": "https://venice.ai/"
    },
    {
        "name": "Paragraph Generator",
        "category": "Writing",
        "description": "Generate well-structured paragraphs instantly for essays, articles, or content with a single click.",
        "url": "https://paragraph-generator.com/"
    },
    {
        "name": "TalkAI",
        "category": "AI Tools",
        "description": "Chat with an AI-powered assistant instantly for answers, ideas, and conversation on any topic.",
        "url": "https://talkai.info/"
    },
    {
        "name": "Experte.com",
        "category": "Business",
        "description": "Access free online tools for SEO, security, design, and productivity all in one platform.",
        "url": "https://www.experte.com/"
    },
    {
        "name": "Card Scanner",
        "category": "Files",
        "description": "Scan business cards, documents, and images instantly with this free online OCR and file converter tool.",
        "url": "https://www.cardscanner.co/"
    },
    {
        "name": "iScanner",
        "category": "Files",
        "description": "Scan documents, photos, and receipts instantly into clear, professional-quality digital files.",
        "url": "https://iscanner.com/"
    },
    {
        "name": "OnlinePhotoScanner",
        "category": "Images",
        "description": "Enhance and digitize your photos instantly with this free online photo scanning and correction tool.",
        "url": "https://onlinephotoscanner.com/"
    },
    {
        "name": "OnlineCamScanner",
        "category": "Files",
        "description": "Turn images into clear, high-quality scanned documents instantly with this free online scanner tool.",
        "url": "https://onlinecamscanner.com/"
    },
    {
        "name": "Freesumes",
        "category": "Business",
        "description": "Access free, stylish resume and cover letter templates to create job-winning applications quickly.",
        "url": "https://www.freesumes.com/"
    },
    {
        "name": "ResumeMaker.online",
        "category": "Business",
        "description": "Create professional resumes online in minutes with customizable templates and instant download options.",
        "url": "https://www.resumemaker.online/"
    },
    {
        "name": "Open Resume",
        "category": "Business",
        "description": "Build and edit professional resumes instantly with this open-source, user-friendly online resume maker.",
        "url": "https://www.open-resume.com/"
    },
    {
        "name": "BibCitation",
        "category": "Writing",
        "description": "Generate citations and bibliographies instantly in APA, MLA, Chicago, and more with this fast online tool.",
        "url": "https://www.bibcitation.com/"
    },
    {
        "name": "Bibliography",
        "category": "Writing",
        "description": "Quickly create accurate citations and bibliographies in any style with this easy-to-use online reference maker.",
        "url": "https://www.bibliography.com/"
    },
    {
        "name": "ZoteroBib",
        "category": "Writing",
        "description": "Build accurate bibliographies in any citation style instantly with this free, reliable reference generator.",
        "url": "https://zbib.org/"
    },
    {
        "name": "BibGuru",
        "category": "Writing",
        "description": "Create flawless citations and bibliographies in any style with this fast, intuitive reference generator.",
        "url": "https://www.bibguru.com/"
    },
    {
        "name": "Scribbr",
        "category": "Writing",
        "description": "Check grammar, improve clarity, and generate citations instantly with this all-in-one academic writing assistant.",
        "url": "https://www.scribbr.com/"
    },
    {
        "name": "MyBib",
        "category": "Writing",
        "description": "Generate accurate citations and bibliographies in seconds with this free, easy-to-use reference tool.",
        "url": "https://www.mybib.com/"
    },
    {
        "name": "PDFgear",
        "category": "Files",
        "description": "Edit, convert, and manage PDFs effortlessly with PDFgear's AI-powered online tools.",
        "url": "https://www.pdfgear.com/"
    },
    {
        "name": "DocFly",
        "category": "Files",
        "description": "Edit, create, and convert PDFs instantly with DocFly's fast, browser-based tools.",
        "url": "https://www.docfly.com/"
    },
    {
        "name": "VPNLY",
        "category": "Security",
        "description": "Browse securely and anonymously with VPNLY's free, high-speed VPN across multiple global servers.",
        "url": "https://vpnly.com/"
    },
    {
        "name": "DeepAI",
        "category": "AI Tools",
        "description": "Instantly create AI-generated images from text prompts with DeepAI's versatile tool.",
        "url": "https://deepai.org/"
    },
    {
        "name": "Muryou Aigazou",
        "category": "AI Tools",
        "description": "Create high-quality AI images instantly from text prompts or photos with ease.",
        "url": "https://muryou-aigazou.com/"
    },
    {
        "name": "Vheer",
        "category": "AI Tools",
        "description": "Generate stunning AI images instantly from text or photos with Vheer's versatile creative tools.",
        "url": "https://vheer.com/"
    },
    {
        "name": "RaphaelAI",
        "category": "AI Tools",
        "description": "Generate AI-powered art and visuals instantly with a simple, intuitive online tool.",
        "url": "https://raphaelai.org/"
    },
    {
        "name": "Web Whiteboard",
        "category": "Productivity",
        "description": "Collaborate instantly on a simple, interactive online whiteboard for teams and projects.",
        "url": "https://webwhiteboard.com/"
    },
    {
        "name": "OnlineBoard",
        "category": "Productivity",
        "description": "Collaborate in real-time on an interactive online whiteboard for brainstorming and planning.",
        "url": "https://onlineboard.eu/"
    },
    {
        "name": "OpenGameArt",
        "category": "Design",
        "description": "Access and download free game assets, including sprites, music, and 3D models instantly.",
        "url": "https://opengameart.org/"
    },
    {
        "name": "Poly Haven",
        "category": "Design",
        "description": "Download free, high-quality 3D assets, HDRIs, and textures instantly for creative projects.",
        "url": "https://polyhaven.com/"
    },
    {
        "name": "CGBookCase",
        "category": "Design",
        "description": "Access and download high-quality PBR textures for 3D projects instantly.",
        "url": "https://www.cgbookcase.com/"
    },
    {
        "name": "AmbientCG",
        "category": "Design",
        "description": "Download high-quality PBR textures and materials instantly for 3D design and visualization.",
        "url": "https://ambientcg.com/"
    },
    {
        "name": "Game-Icons",
        "category": "Design",
        "description": "Access thousands of free, customizable icons perfect for games and digital projects.",
        "url": "https://game-icons.net/"
    },
    {
        "name": "DrawingDatabase",
        "category": "Design",
        "description": "Explore and access a vast library of drawing references and resources instantly.",
        "url": "https://drawingdatabase.com/"
    },
    {
        "name": "3DTextures",
        "category": "Design",
        "description": "Browse and download seamless 3D textures for your design and 3D modeling projects instantly.",
        "url": "https://3dtextures.me/"
    },
    {
        "name": "Site-Shot",
        "category": "Images",
        "description": "Capture full-page website screenshots instantly and effortlessly from any browser.",
        "url": "https://www.site-shot.com/"
    },
    {
        "name": "Paraphrasing-Tool",
        "category": "Writing",
        "description": "Easily rewrite and rephrase text instantly to improve clarity and originality.",
        "url": "https://paraphrasing-tool.com/"
    },
    {
        "name": "LanguageTool",
        "category": "Writing",
        "description": "Instantly check grammar, style, and spelling in multiple languages with a powerful online editor.",
        "url": "https://languagetool.org/"
    },
    {
        "name": "GrammarCheck",
        "category": "Writing",
        "description": "Check and correct grammar instantly with a simple, reliable online tool.",
        "url": "https://www.grammarcheck.net/"
    },
    {
        "name": "Quiz Maker",
        "category": "General Tools",
        "description": "Create interactive quizzes online with customizable questions and instant results.",
        "url": "https://www.quiz-maker.com/"
    },
    {
        "name": "HeySurvey",
        "category": "Business",
        "description": "Create unlimited online surveys with custom designs and advanced question types instantly.",
        "url": "https://heysurvey.io/"
    },
    {
        "name": "Fast Poll",
        "category": "Business",
        "description": "Create instant, real-time polls and gather votes quickly from any audience.",
        "url": "https://fast-poll.com/"
    },
    {
        "name": "StrawPoll",
        "category": "Business",
        "description": "Create instant polls and surveys to gather opinions and schedule events quickly.",
        "url": "https://strawpoll.com/"
    },
    {
        "name": "Polls.io",
        "category": "Business",
        "description": "Create quick, shareable polls and surveys to gather opinions instantly online.",
        "url": "https://polls.io/"
    },
    {
        "name": "TickCounter",
        "category": "Productivity",
        "description": "Create customizable countdowns, timers, and clocks for any event with instant online setup.",
        "url": "https://www.tickcounter.com/"
    },
    {
        "name": "FreeOnlineDice",
        "category": "General Tools",
        "description": "Roll virtual dice or flip a coin instantly for games, decisions, or random outcomes.",
        "url": "https://freeonlinedice.com/"
    },
    {
        "name": "Pikwy",
        "category": "Images",
        "description": "Capture high-resolution full-page screenshots of websites instantly on any device.",
        "url": "https://pikwy.com/"
    },
    {
        "name": "Internet Archive",
        "category": "Media",
        "description": "Access millions of free books, movies, music, software, and historical web pages instantly.",
        "url": "https://archive.org/"
    },
    {
        "name": "AutoDraw",
        "category": "Design",
        "description": "Turn rough sketches into polished drawings instantly with AI-assisted suggestions.",
        "url": "https://www.autodraw.com/"
    },
    {
        "name": "BrandColors",
        "category": "Design",
        "description": "Access the largest collection of official brand color codes for design and marketing projects.",
        "url": "https://brandcolors.net/"
    },
    {
        "name": "RealFaviconGenerator",
        "category": "Design",
        "description": "Generate perfect favicons for all devices and browsers with instant previews and setup instructions.",
        "url": "https://realfavicongenerator.net/"
    },
    {
        "name": "FreeConvert",
        "category": "Files",
        "description": "Convert videos, images, audio, documents, and more across 1500+ formats instantly online.",
        "url": "https://www.freeconvert.com/"
    },
    {
        "name": "Behind the Name",
        "category": "Language",
        "description": "Discover the history, meanings, and cultural origins of names from around the world.",
        "url": "https://www.behindthename.com/"
    },
    {
        "name": "Fake Name Generator",
        "category": "General Tools",
        "description": "Generate realistic fake identities with names, addresses, and personal details for testing or creative use.",
        "url": "https://www.fakenamegenerator.com/"
    },
    {
        "name": "Name Generator",
        "category": "Language",
        "description": "Generate creative names for characters, babies, businesses, pets, or projects with customizable filters.",
        "url": "https://www.name-generator.org.uk/"
    },
    {
        "name": "Random Word Generator",
        "category": "Language",
        "description": "Generate random words, names, sentences, and more with customizable filters for endless creativity.",
        "url": "https://randomwordgenerator.com/"
    },
    {
        "name": "DinoPass",
        "category": "Security",
        "description": "Generate fun, kid-friendly passwords that balance simplicity and security for everyday use.",
        "url": "https://www.dinopass.com/"
    },
    {
        "name": "Strong Password Generator",
        "category": "Security",
        "description": "Generate secure, random passwords instantly with customizable options for maximum protection.",
        "url": "https://www.strongpasswordgenerator.org/"
    },
    {
        "name": "Dupli Checker",
        "category": "Writing",
        "description": "Scan text or documents for plagiarism with AI-powered checks and detailed originality reports.",
        "url": "https://www.duplichecker.com/"
    },
    {
        "name": "Paraphraser",
        "category": "Writing",
        "description": "Rephrase text instantly with AI-powered paraphrasing modes that improve clarity and avoid plagiarism.",
        "url": "https://www.paraphraser.io/"
    },
    {
        "name": "Plagiarism Detector",
        "category": "Writing",
        "description": "Detect duplicate content instantly with detailed percentage reports for essays, articles, and documents.",
        "url": "https://plagiarismdetector.net/"
    },
    {
        "name": "Plagibot",
        "category": "Writing",
        "description": "Check text for plagiarism instantly with fast, accurate detection across billions of web pages.",
        "url": "https://plagibot.com/"
    },
    {
        "name": "Pixian",
        "category": "Images",
        "description": "Remove image backgrounds with AI-powered accuracy, supporting photos, logos, and artworks in seconds.",
        "url": "https://pixian.ai/"
    },
    {
        "name": "Retoucher",
        "category": "Images",
        "description": "Remove and replace image backgrounds instantly with AI-powered precision, perfect for products or portraits.",
        "url": "https://retoucher.online/"
    },
    {
        "name": "3D Gif Maker",
        "category": "Images",
        "description": "Create stunning 3D GIFs from images or videos instantly, with customizable rotation and effects.",
        "url": "https://www.3dgifmaker.com/"
    },
    {
        "name": "YouCompress",
        "category": "Files",
        "description": "Quickly reduce file sizes for videos, images, audio, and documents without losing quality.",
        "url": "https://www.youcompress.com/"
    },
    {
        "name": "EditVideo",
        "category": "Media",
        "description": "Edit, trim, crop, and enhance videos instantly in your browser - fast, private, and watermark-free.",
        "url": "https://edit.video/"
    },
    {
        "name": "TodoListMe",
        "category": "Productivity",
        "description": "A minimalist to-do list app that works offline, stores data locally, and requires no sign-up.",
        "url": "https://todolistme.net/"
    },
    {
        "name": "Checkli",
        "category": "Productivity",
        "description": "Create, share, and track checklists instantly to streamline tasks and processes.",
        "url": "https://www.checkli.com/"
    },
    {
        "name": "Snapdrop",
        "category": "Files",
        "description": "Local network file sharing with peer-to-peer transfers using WebRTC, no cloud storage required.",
        "url": "https://snapdrop.net/"
    },
    {
        "name": "File.io",
        "category": "Files",
        "description": "Upload files securely, get a temporary shareable link, and have the file auto-delete after download or expiration.",
        "url": "https://www.file.io/"
    },
    {
        "name": "PrivateBin",
        "category": "Security",
        "description": "Encrypted pastebin service where shared text self-destructs after reading with zero-knowledge privacy.",
        "url": "https://privatebin.net/"
    },
    {
        "name": "Write.as",
        "category": "Writing",
        "description": "Minimalist writing platform for focused composition with instant publishing and optional anonymity.",
        "url": "https://write.as/"
    },
    {
        "name": "RawGraphs",
        "category": "Data Tools",
        "description": "Open-source data visualization framework for creating custom charts from CSV/Excel data without coding.",
        "url": "https://www.rawgraphs.io/"
    },
    {
        "name": "File Pizza",
        "category": "Files",
        "description": "Peer-to-peer file sharing in your browser with instant transfers and no size limits.",
        "url": "https://file.pizza"
    },
    {
        "name": "PrintFriendly",
        "category": "Productivity",
        "description": "Optimize web pages for printing or PDF conversion by removing ads, navigation, and unnecessary elements.",
        "url": "https://www.printfriendly.com/"
    },
    {
        "name": "Wheel of Names",
        "category": "General Tools",
        "description": "Customizable random name picker with colorful spinning wheel visuals for draws, prizes, or classroom selection.",
        "url": "https://wheelofnames.com/"
    },
    {
        "name": "DevDocs",
        "category": "Development",
        "description": "All-in-one API documentation browser with offline access, keyboard shortcuts, and multi-doc search.",
        "url": "https://devdocs.io/"
    },
    {
        "name": "Wolfram Alpha",
        "category": "Math & STEM",
        "description": "Computational knowledge engine solving complex math, science, and engineering problems with step-by-step solutions.",
        "url": "https://www.wolframalpha.com/"
    },
    {
        "name": "GeoGebra",
        "category": "Math & STEM",
        "description": "Dynamic mathematics software combining geometry, algebra, calculus, and interactive graphing.",
        "url": "https://www.geogebra.org/"
    },
    {
        "name": "Skribbl.io",
        "category": "General Tools",
        "description": "Multiplayer online drawing and guessing game with custom word lists and real-time chat.",
        "url": "https://skribbl.io/"
    },
    {
        "name": "AudioMass",
        "category": "Media",
        "description": "Browser-based audio editor with multi-track mixing, effects, and filters for professional-level editing.",
        "url": "https://audiomass.co/"
    },
    {
        "name": "JS Bin",
        "category": "Development",
        "description": "Live-edit and preview HTML, CSS, and JavaScript with support for preprocessors, real-time output, and instant sharing.",
        "url": "https://jsbin.com/"
    },
    {
        "name": "TextFixer",
        "category": "Writing",
        "description": "Collection of text manipulation tools for cleaning, formatting, and converting written content.",
        "url": "https://www.textfixer.com/"
    },
    {
        "name": "VideoSmaller",
        "category": "Media",
        "description": "Compress and resize videos online without losing quality, with adjustable settings for file size and format.",
        "url": "https://www.videosmaller.com/"
    },
    {
        "name": "Ezgif",
        "category": "Media",
        "description": "Online GIF editor and converter with tools for resizing, cropping, optimizing, and creating animations.",
        "url": "https://ezgif.com/"
    },
    {
        "name": "GTmetrix",
        "category": "Development",
        "description": "Website performance analyzer measuring load times with waterfall charts and optimization recommendations.",
        "url": "https://gtmetrix.com/"
    },
    {
        "name": "Online Stopwatch",
        "category": "General Tools",
        "description": "Full-screen digital stopwatch, countdown timer, and alarm clock with lap time recording.",
        "url": "https://www.online-stopwatch.com/"
    },
    {
        "name": "Image Enlarger",
        "category": "Images",
        "description": "Upscale small images using customizable resampling methods - preserving clarity and minimizing artifacts.",
        "url": "https://www.imageenlarger.com/"
    },
    {
        "name": "PDF Resizer",
        "category": "Files",
        "description": "Resize, compress, and reformat PDF documents for optimal printing or digital distribution.",
        "url": "https://pdfresizer.com/"
    },
    {
        "name": "Rewordify",
        "category": "Writing",
        "description": "Simplify complex text into easier versions with highlighted translations, vocabulary support, and learning sessions.",
        "url": "https://rewordify.com/"
    },
    {
        "name": "ASCII Art Generator",
        "category": "General Tools",
        "description": "Transform images into customizable ASCII art with adjustable character density and palette options.",
        "url": "https://www.ascii-art-generator.org/"
    },
    {
        "name": "Epoch Converter",
        "category": "Development",
        "description": "Convert Unix timestamps to human-readable dates and vice versa with timezone support for developers.",
        "url": "https://www.epochconverter.com/"
    },
    {
        "name": "JSON Crack",
        "category": "Development",
        "description": "Visualize JSON data as interactive graphs instantly to understand complex structures.",
        "url": "https://jsoncrack.com/"
    },
    {
        "name": "Carbon",
        "category": "Development",
        "description": "Create beautiful, shareable images of your code snippets with customizable themes and window styles.",
        "url": "https://carbon.now.sh/"
    },
    {
        "name": "Ray.so",
        "category": "Development",
        "description": "Generate sleek, beautiful screenshots of your code instantly with gradient backgrounds and syntax highlighting.",
        "url": "https://ray.so/"
    },
    {
        "name": "Excalidraw",
        "category": "Design",
        "description": "Sketch diagrams and illustrations with a hand-drawn feel on a virtual whiteboard.",
        "url": "https://excalidraw.com/"
    },
    {
        "name": "Squibler",
        "category": "Writing",
        "description": "Overcome writer's block with \"The Most Dangerous Writing App\" - stop typing, and your progress disappears.",
        "url": "https://www.squibler.io/dangerous-writing-prompt-app"
    },
    {
        "name": "Hemingway Editor",
        "category": "Writing",
        "description": "Improve your writing's clarity and readability by highlighting complex sentences and passive voice.",
        "url": "https://hemingwayapp.com/"
    },
    {
        "name": "Dictation.io",
        "category": "Writing",
        "description": "Type with your voice in multiple languages using accurate, real-time speech-to-text technology.",
        "url": "https://dictation.io/"
    },
    {
        "name": "ZenPen",
        "category": "Writing",
        "description": "Write in a distraction-free environment with a clean, minimalist interface.",
        "url": "https://www.zenpen.io/"
    },
    {
        "name": "Diffchecker",
        "category": "Development",
        "description": "Compare text, files, and images side-by-side to spot differences effectively.",
        "url": "https://www.diffchecker.com/"
    },
    {
        "name": "Regex101",
        "category": "Development",
        "description": "Build, test, and debug regular expressions with real-time explanation and matching.",
        "url": "https://regex101.com/"
    },
    {
        "name": "Can I Use",
        "category": "Development",
        "description": "Check browser support tables for modern HTML, CSS, and JavaScript features.",
        "url": "https://caniuse.com/"
    },
    {
        "name": "Meta Tags",
        "category": "Development",
        "description": "Preview and generate meta tags for social media sharing and SEO.",
        "url": "https://metatags.io/"
    },
    {
        "name": "Squoosh",
        "category": "Images",
        "description": "Compress and compare images with different codecs directly in your browser.",
        "url": "https://squoosh.app/"
    },
    {
        "name": "Photopea",
        "category": "Images",
        "description": "Advanced online photo editor supporting PSD, XCF, Sketch, and XD formats.",
        "url": "https://www.photopea.com/"
    },
    {
        "name": "Vector Magic",
        "category": "Images",
        "description": "Convert bitmap images into clean, scalable vector graphics automatically.",
        "url": "https://vectormagic.com/"
    },
    {
        "name": "Coolors",
        "category": "Design",
        "description": "Generate perfect color palettes for your designs in seconds.",
        "url": "https://coolors.co/"
    },
    {
        "name": "Font Joy",
        "category": "Design",
        "description": "Generate font pairings with deep learning to find the perfect typography combinations.",
        "url": "https://fontjoy.com/"
    },
    {
        "name": "Type Scale",
        "category": "Design",
        "description": "Visual calculator to create harmonious typography scales for your projects.",
        "url": "https://typescale.com/"
    },
    {
        "name": "Lorem Ipsum",
        "category": "General Tools",
        "description": "Generate placeholder text for your layouts with various customization options.",
        "url": "https://loremipsum.io/"
    },
    {
        "name": "VirusTotal",
        "category": "Security",
        "description": "Analyze files and URLs for viruses, worms, trojans, and other malicious content.",
        "url": "https://www.virustotal.com/"
    },
    {
        "name": "Have I Been Pwned",
        "category": "Security",
        "description": "Check if your email or phone number has been compromised in a data breach.",
        "url": "https://haveibeenpwned.com/"
    },
    {
        "name": "Temp Mail",
        "category": "Security",
        "description": "Get a temporary, disposable email address to protect your privacy and avoid spam.",
        "url": "https://temp-mail.org/"
    },
    {
        "name": "10 Minute Mail",
        "category": "Security",
        "description": "Free temporary email service that self-destructs after 10 minutes.",
        "url": "https://10minutemail.com/"
    },
    {
        "name": "Privnote",
        "category": "Security",
        "description": "Send notes that will self-destruct after being read.",
        "url": "https://privnote.com/"
    },
    {
        "name": "Wormhole",
        "category": "Files",
        "description": "Simple, private file sharing. Files are encrypted end-to-end and expire automatically.",
        "url": "https://wormhole.app/"
    },
    {
        "name": "WeTransfer",
        "category": "Files",
        "description": "Send large files up to 2GB for free without registration.",
        "url": "https://wetransfer.com/"
    },
    {
        "name": "Archive.ph",
        "category": "Media",
        "description": "Create a copy of a webpage that will remain online even if the original page changes or disappears.",
        "url": "https://archive.ph/"
    },
    {
        "name": "12ft Ladder",
        "category": "Media",
        "description": "Remove paywalls and ads from news articles to read them cleanly.",
        "url": "https://12ft.io/"
    },
    {
        "name": "Radio Garden",
        "category": "Media",
        "description": "Explore live radio stations from around the world by rotating the globe.",
        "url": "https://radio.garden/"
    },
    {
        "name": "Drive & Listen",
        "category": "Media",
        "description": "Drive through cities around the world while listening to local radio stations.",
        "url": "https://driveandlisten.herokuapp.com/"
    },
    {
        "name": "WindowSwap",
        "category": "Media",
        "description": "Open a new window somewhere in the world and enjoy the view.",
        "url": "https://www.window-swap.com/"
    },
    {
        "name": "A Soft Murmur",
        "category": "Productivity",
        "description": "Ambient sounds to wash away distraction and help you focus or relax.",
        "url": "https://asoftmurmur.com/"
    },
    {
        "name": "Noisli",
        "category": "Productivity",
        "description": "Background noise generator for working and relaxing.",
        "url": "https://www.noisli.com/"
    },
    {
        "name": "Pomofocus",
        "category": "Productivity",
        "description": "Customizable Pomodoro timer that works on desktop and mobile browser.",
        "url": "https://pomofocus.io/"
    },
    {
        "name": "Forest",
        "category": "Productivity",
        "description": "Stay focused and plant real trees with this gamified timer (Web version).",
        "url": "https://www.forestapp.cc/"
    },
    {
        "name": "Toggl Track",
        "category": "Productivity",
        "description": "Simple time tracking for freelancers and teams (Free version available).",
        "url": "https://toggl.com/track/"
    },
    {
        "name": "Clockify",
        "category": "Productivity",
        "description": "Free time tracker and timesheet app for teams of all sizes.",
        "url": "https://clockify.me/"
    },
    {
        "name": "Notion",
        "category": "Productivity",
        "description": "All-in-one workspace for notes, tasks, wikis, and databases.",
        "url": "https://www.notion.so/"
    },
    {
        "name": "Obsidian",
        "category": "Productivity",
        "description": "A powerful knowledge base that works on top of a local folder of plain text Markdown files.",
        "url": "https://obsidian.md/"
    },
    {
        "name": "Trello",
        "category": "Productivity",
        "description": "Collaborate, manage projects, and reach new productivity peaks.",
        "url": "https://trello.com/"
    },
    {
        "name": "Asana",
        "category": "Productivity",
        "description": "Work management platform that helps teams stay on track.",
        "url": "https://asana.com/"
    }
];

// Process raw data into Zepra Marketplace format
const toolsData = rawToolsData.map((tool, index) => {
    return {
        id: `tool-${index}-${tool.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name: tool.name,
        description: tool.description,
        url: tool.url,
        category: tool.category,
        icon: "", // Will be computed in marketplace.js
        badges: index < 5 ? ["hot"] : (index > 20 && index < 25 ? ["new"] : []), // Fake badges for demo
        preview_img: "", // Placeholder or fetch dynamic
        popularity: Math.floor(Math.random() * 100)
    };
});
