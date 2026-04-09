const FLOW_I18N = {
  "en": {
    "messages": {
      "notUnderstood": "I didn't fully get that. Use the buttons, or type 'menu' to go back.",
      "missingNode": "Oops... I couldn't find that step.",
      "unsupportedNode": "This step type is not supported yet.",
      "loopDetected": "I got stuck in a loop. Tap 'menu' to restart this thread.",
      "ok": "Okay.",
      "playingAudio": "Playing audio...",
      "sharingFile": "Sharing a file...",
      "noRoute": "I couldn't find where to route that.",
      "doneWhatElse": "All set. What else do you need?",
      "faqPrompt": "Click 'FAQ' in the help panel.",
      "whatsappLater": "I'll take you to WhatsApp at the end so everything goes in order.\n\nLet's finish these 1-2 steps and the button will appear.",
      "whatsappReady": "All set. Tap the WhatsApp button and I'll take you there directly. I already have your info and where you are in the flow.",
      "defaultMenu": "Okay... menu?",
      "buttonsOnly": "To continue, choose an option with the buttons.",
      "transferDefault": "All set. I'll connect you with a person."
    },
    "nodes": {
      "ask_name": {
        "text": "Thanks for contacting Musicala, an arts training school. Before we begin, could you tell us your name?",
        "options": [
          "Prefer not to share"
        ],
        "media": [
          {
            "type": "audio",
            "url": "assets/introaudioenglish.mp3"
          }
        ]
      },
      "ask_phone": {
        "text": "Could you now tell us your phone number? (e.g. +57 300 123 4567)"
      },
      "show_program_options": {
        "text": "Discover our options in Music, Dance, Visual Arts and Theatre!\n\n1. Holiday Programs - Fun artistic experiences for vacations or school breaks.\n2. On-site Classes - At our campus, with one-on-one classes or small groups.\n3. Online Classes - Learn from home with live classes or at your own pace on our platform.\n4. At-home Classes - Teachers at home. We bring the arts to your door.\n5. Other Services - Space rentals, instrument store, events and more.\n\nWhich option would you like to explore?",
        "options": [
          "Holiday Programs",
          "On-site Classes",
          "Online Classes",
          "At-home Classes",
          "Other Services"
        ]
      },
      "menu_fallback": {
        "text": "I got part of it. To help you better, choose an option with the buttons:",
        "options": [
          "Holiday Programs",
          "On-site Classes",
          "Online Classes",
          "At-home Classes",
          "Other Services"
        ]
      },
      "flow_vacacionales": {
        "text": "This vacation season, live the arts at Musicala!\n\nFrom January 13 to February 6, enjoy an artistic experience with music, dance, theatre and visual arts.\n\nAvailable modalities:\nOn-site at our campus (Pasadena)\nAt home\nLive online\n\nGroups of 2 to 6 people\nPersonalized classes\nDuration: 60 minutes\nFlexible schedules\n\nLimited spots\nTell us the student's age and we'll share the best option.",
        "options": [
          "1 to 3",
          "4 to 6",
          "7 to 11",
          "12 to 15",
          "16 to 40",
          "40 and up",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "vacacionales_4a15_offer": {
        "text": "For this age range we have two great paths.\n\nArts Holiday Program\n4 hours of art every morning (Mon-Fri), with music, dance, theatre and visual arts activities.\n\nIntensive Courses\nClasses focused on one discipline (music, dance, theatre or visual arts), with flexible schedules and seasonal discounts.\n\nWhich one interests you most?",
        "options": [
          "Arts Holiday Program",
          "Intensive Courses",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_vacaciones_artisticas": {
        "text": "Arts Holiday Program at Musicala\n\nDuring these weeks, children ages 4 to 15 enjoy a creative experience in 4-hour morning sessions (9:00 a.m. to 1:00 p.m.):\n\nVisual Arts: painting, sculpture and crafts\nMusic: rhythm games, melodies and creation\nDance and Theatre: body expression and confidence\nTeamwork: cooperation and collaboration\n\nWhen you're ready, I can show you the plans.",
        "options": [
          "See pricing",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "vac_art_precios": {
        "text": "These are the plans available for the Arts Holiday Program week:\n\n16-hour plan: $424,000\n20-hour plan: $478,000\n\nWe have discounts for siblings, cousins or referrals.\nAnd if you want more than one week, there is also a continuity benefit.\n\nAge groups:\nMusicalitos (4 to 6)\nMusikids (7 to 11)\nMusiteens (12 to 15)\n\nIf you want, I can show you the step-by-step enrollment process.",
        "options": [
          "Enrollment steps",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "vac_art_inscripcion": {
        "text": "You're almost in! To finish enrollment:\n\n1. Complete the form with the student's information.\n2. Make the payment for the selected plan and send us the receipt here.\n\nThat secures the spot.\n\nWould you like me to send the form now, or would you prefer to talk to an advisor?",
        "options": [
          "Send form",
          "Talk to an advisor",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "vac_art_formulario": {
        "text": "Here is the enrollment form:\nhttps://docs.google.com/forms/d/e/1FAIpQLSecZ_FpjAvMewItcek5N2Hc2QFhTNlS4CdmNSb3T4q4xnQxmQ/viewform\n\nWhen you finish it, come back and tell me so we can continue with payment.",
        "options": [
          "I already filled it out",
          "Talk to an advisor",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "vac_art_cierre_final": {
        "text": "Great! You're just one step away from living an art-filled experience with Musicala.\n\nBefore speaking with our human team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, modalities and more.\n\nTake a look, and when you're ready for the next step, you can also write to us on WhatsApp.\n\nThanks for trusting Musicala. An unforgettable artistic journey starts here.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "intensivos_age_gate": {
        "text": "Perfect. To give you the most accurate info about Intensive Courses, which age range is the student in?",
        "options": [
          "4 to 6",
          "7 to 11",
          "12 to 15",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "vacacionales_intensivos_msg": {
        "text": "Musicala Intensive Courses\n\nA great option to learn, improve or return to what you love most: music, dance, visual arts or theatre.\n\nFlexible schedules, personalized classes or small groups, and seasonal discounts.\n\nWhat would you like to learn?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "intensivos_modalidad_msg": {
        "text": "Perfect. Which modality would you like to take the classes in?\n\nOn-site at our campus (Pasadena, Bogota)\nMusicala Home (personalized classes at your home)\nLive online (from anywhere)",
        "options": [
          "On-site",
          "Musicala Home",
          "Online",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_intensivos_sede": {
        "text": "Great! You're just one step away from living an art-filled experience with Musicala.\n\nBefore speaking with our human team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, modalities and more.\n\nTake a look, and when you're ready for the next step, you can also write to us on WhatsApp.\n\nThanks for trusting Musicala. An unforgettable artistic journey starts here.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_intensivos_hogar": {
        "text": "Great! You're just one step away from living an art-filled experience with Musicala.\n\nBefore speaking with our human team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, modalities and more.\n\nTake a look, and when you're ready for the next step, you can also write to us on WhatsApp.\n\nThanks for trusting Musicala. An unforgettable artistic journey starts here.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_intensivos_virtual": {
        "text": "Great! You're just one step away from living an art-filled experience with Musicala.\n\nBefore speaking with our human team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, modalities and more.\n\nTake a look, and when you're ready for the next step, you can also write to us on WhatsApp.\n\nThanks for trusting Musicala. An unforgettable artistic journey starts here.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_presencial": {
        "text": "Discover our On-site Class options at our campus.\n\nArt as Social Change: We believe in the power of art to impact lives and support social causes.\n\nExpert Teachers and Personalized Classes: Our team is dedicated to your artistic growth with high-quality education.\n\nCREA Methodology: We adapt our teaching to your abilities with advanced technological tools for a unique experience.\n\nTo guide you better, tell us the student's age:",
        "options": [
          "1 to 3",
          "4 to 6",
          "7 to 11",
          "12 to 15",
          "16 to 50",
          "50 and up",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_age_info": {
        "text": "Perfect. Now choose the art area you're interested in for on-site classes:",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_age_info_1a3": {
        "text": "Musibabies is our artistic stimulation plan for little ones ages 1 to 3.\n\nHere they enjoy a loving and creative experience where we work on all the arts from an early age:\n\nMusic\nDance\nTheatre through body expression\nVisual Arts\n\nAt our campus, Musibabies is offered as personalized classes, designed to strengthen bonding, exploration, and holistic development through art.\n\nIf you'd like to learn more about everything we do at these ages, you can explore it here:\nhttps://musicala.github.io/musiedades/\n\nWhich plan would you like to take?",
        "options": [
          "4-class package",
          "8-class package",
          "12-class package",
          "24-class package",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_age_info_4a6": {
        "text": "In our Music, Dance, Theatre, and Visual Arts exploration courses, every day is a chance to discover the magic of art. With child-sized instruments, movements that tell stories, and brushstrokes full of imagination, little ones dive into a world of creativity and fun.\n\nMusic to feel and create rhythms, dance to express and move freely, theatre to play, imagine, and tell stories with the body and voice, and visual arts to paint dreams. Here, every little Musicalito shines while exploring and enjoying art.\n\nWhich area would you like to learn more about for your Musicalito?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Back to menu"
        ]
      },
      "presencial_arte_info": {
        "text": "Musibabies Modalities - On-site classes full of love and art.\n\nPersonalized: Intimate sessions for your baby, you, and an expert teacher. Early stimulation and connection through art.\n\nSee the full Musibabies path here: https://s.kbe.ai/s/PDDLV7\n\nWhich plan would you like to take?",
        "options": [
          "4-class package",
          "8-class package",
          "12-class package",
          "24-class package",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musicalitos_musica": {
        "text": "In the musical exploration plan, your little one will learn music through the body, the voice, and fun instruments like the ukulele, egg shakers, tambourines, and xylophone.\nWe use colors and numbers to make notes easy and super fun to understand.\nBest of all: they will grow a love for art from an early age.\n\nSee the path for our Musicalitos here: https://drive.google.com/file/d/15DsuCeVW0p_8vNi0TI7m8_by9VpB0A4e/view\n\nAt Musicala, we have lovingly created in-person experiences specially designed for our young artists and their wonderful families.\n\nMusicalitos Personalized: Unique sessions where your little artist receives the full attention of a specialized teacher. Perfect for personalized learning, these classes focus on stimulating your Musicalito's creative and emotional development, offering a special experience of connection and discovery.\n\nMusicalitos in Group: Your Musicalito joins a warm group of 2 to 6 children, always accompanied by their families. These classes promote interaction, collective play, and social skills in a loving and safe environment.\n\nEach modality is designed to offer a beautiful introduction to the world of art, making the experience memorable and enriching for both children and their families.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musicalitos_danza": {
        "text": "In this magical journey, dance is explored through movement, body expression, and basic dance steps specially adapted for young children. Imagine your little one moving to the rhythm of music, discovering space with spins and jumps, and expressing stories with their body.\n\nThis adventure goes beyond simply dancing; it is learning full of creativity and fun. We use colors and shapes to teach concepts of space and rhythm, helping children develop coordination and musicality while connecting movement with visual and tactile elements they already know.\n\nThe most exciting part is seeing how your child begins to express themselves and discover a lasting love for dance from an early age.\n\nFor more information about our Musicalitos path, follow this link: https://drive.google.com/file/d/1_Hhs0IDTih9cJbHfgeieQvlDg_YV3SeN/view\n\nAt Musicala, we have lovingly created in-person experiences specially designed for our young artists and their wonderful families.\n\nMusicalitos Personalized: Unique sessions where your little artist receives the full attention of a specialized teacher. Perfect for personalized learning, these classes focus on stimulating your Musicalito's creative and emotional development, offering a special experience of connection and discovery.\n\nMusicalitos in Group: Your Musicalito joins a warm group of 2 to 6 children, always accompanied by their families. These classes promote interaction, collective play, and social skills in a loving and safe environment.\n\nEach modality is designed to offer a beautiful introduction to the world of art, making the experience memorable and enriching for both children and their families.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musicalitos_teatro": {
        "text": "In this adventure, theatre is discovered through play, body expression, voice, and imagination, all adapted for young children. Imagine your little one creating characters, representing emotions, and telling stories with their body, gestures, and voice in scenes full of magic and fun.\n\nThis exploration goes far beyond acting. Through dynamics, music, sequences, and theatre games, children strengthen attention, memory, confidence, and communication while learning to recognize emotions and enjoy art through play and movement.\n\nThe most beautiful part is seeing your child gain confidence to express themselves, share what they feel, and fall in love with theatre from an early age.\n\nFor more information about our Musicalitos path, follow this link: https://musicala.github.io/musiedades/\n\nAt Musicala, we have lovingly created in-person experiences specially designed for our young artists and their wonderful families.\n\nMusicalitos Personalized: Unique sessions where your little artist receives the full attention of a specialized teacher. Perfect for personalized learning, these classes focus on stimulating your Musicalito's creative and emotional development, offering a special experience of connection and discovery.\n\nMusicalitos in Group: Your Musicalito joins a warm group of 2 to 6 children, always accompanied by their families. These classes promote interaction, collective play, and social skills in a loving and safe environment.\n\nEach modality is designed to offer a beautiful introduction to the world of art, making the experience memorable and enriching for both children and their families.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musicalitos_artes": {
        "text": "In this wonderful adventure, visual arts are discovered through color, shape, and techniques adapted to young children. Imagine your little one creating, painting, and modeling, transforming simple materials into works of art while exploring creativity to the fullest.\n\nThis exploration goes far beyond painting and modeling; it is a learning process full of imagination and fun. We use bright colors and varied shapes to teach basic art concepts, helping children develop visual perception and fine motor skills through play and discovery.\n\nThe truly magical part is seeing how your child begins to express their inner world and develop a passion for visual arts from an early age.\n\nFor more information about our Musicalitos path, follow this link: https://drive.google.com/file/d/1q7-rZy8irU2hO5CADtNZCc-TmtT_7heP/view\n\nAt Musicala, we have lovingly created in-person experiences specially designed for our young artists and their wonderful families.\n\nMusicalitos Personalized: Unique sessions where your little artist receives the full attention of a specialized teacher. Perfect for personalized learning, these classes focus on stimulating your Musicalito's creative and emotional development, offering a special experience of connection and discovery.\n\nMusicalitos in Group: Your Musicalito joins a warm group of 2 to 6 children, always accompanied by their families. These classes promote interaction, collective play, and social skills in a loving and safe environment.\n\nEach modality is designed to offer a beautiful introduction to the world of art, making the experience memorable and enriching for both children and their families.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musicalitos_personalizado_final": {
        "text": "Here are the plans for Musicalitos Personalized.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather speak with an advisor, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_musicalitos_grupal_final": {
        "text": "Here are the plans for Musicalitos Group Classes.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather speak with an advisor, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_tipo_clase": {
        "text": "Great. What type of classes are you interested in?",
        "options": [
          "Group classes",
          "Personalized classes",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_info_modalidad": {
        "text": "Great. You're now closer to living an artistic experience with Musicala.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and much more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather speak with an advisor, you can also write to us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_age_info_7a11": {
        "text": "Our Music, Dance, Theatre, and Visual Arts immersion courses are designed to spark passion and creativity in every child. With instruments adapted to their abilities, choreographies full of adventure, imaginative theatre games, and creative techniques, our Musikids begin a journey through the world of art.\n\nMusic to create melodies, dance to express emotions with energy, theatre to communicate, imagine, and build confidence, and visual arts to shape their ideas.\n\nWhich art area would you like to explore with us?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Back to menu"
        ]
      },
      "presencial_musikids_musica": {
        "text": "In Musikids, music is experienced through singing, instrument practice, and age-appropriate music theory.\n\nChildren strengthen listening, rhythm, technique, and creativity while they improvise, explore, and build a close relationship with music.\n\nSee the Musikids path here:\nhttps://drive.google.com/file/d/1YGYRjhaFADSoIgQbQaL09M4BnO0gKsTz/view\n\nChoose the instrument you would like to learn:",
        "options": [
          "Piano/Keyboard",
          "Guitar",
          "Singing/Vocal Technique",
          "Violin",
          "Drums",
          "Cello",
          "Electric Bass",
          "Ukulele",
          "Wind Instruments",
          "Other",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musikids_danza": {
        "text": "In Musikids, dance becomes a space to explore movement, body expression, and different styles through dynamic and fun classes.\n\nWe work on coordination, technique, discipline, and teamwork while each child discovers how to express themselves through dance.\n\nSee the Musikids path here:\nhttps://drive.google.com/file/d/1CtS8mKx_H7GxcLJIHVGXRe1ofEQPiO1K/view\n\nAvailable styles:\n• Latin Dances\n• Classical Dance/Ballet\n• Urban Dances\n• Folk Dances\n• Other\n\nChoose the dance style that interests you most:",
        "options": [
          "Latin Dances",
          "Classical Dance/Ballet",
          "Urban Dances",
          "Folk Dances",
          "Other",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musikids_artes": {
        "text": "In Musikids, visual arts open the door to drawing, painting, crafts, and mixed techniques, always through age-appropriate activities.\n\nChildren explore materials, strengthen fine motor skills, and learn to express ideas, emotions, and imagination through what they create.\n\nSee the Musikids path here:\nhttps://drive.google.com/file/d/1B_uppIIZTZK6j-q7y9ZgF82a4rLu2sSG/view\n\nAvailable techniques:\n• Drawing\n• Painting\n• Crafts\n• Mixed Techniques\n\nWhich technique would you like to learn?",
        "options": [
          "Drawing",
          "Painting",
          "Crafts",
          "Mixed Techniques",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musikids_teatro": {
        "text": "In Musikids, theatre is a space to play, imagine, create characters, and tell stories through the body, the voice, and emotions.\n\nThrough theatre games, improvisation, and body expression, children strengthen confidence, communication, creativity, and teamwork while enjoying art in a close and playful way.\n\nIf you'd like to learn more about our proposal for these ages, you can also explore:\nhttps://musicala.github.io/musiedades/\n\nHere is the information about our on-site classes for Musikids:\n\nPersonalized Classes: Close teacher support, ideal for advancing according to the student's pace, interests, and goals.\n\nGroup Classes for Musikids: Groups of up to 6 students to learn, share, and strengthen artistic and social skills in a creative and safe environment.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musikids_modalidades": {
        "text": "Here is the information about our on-site classes for Musikids:\n\nPersonalized Classes: Close teacher support, ideal for advancing according to the student's pace, interests, and goals.\n\nGroup Classes for Musikids: Groups of up to 6 students to learn, share, and strengthen artistic and social skills in a creative and safe environment.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musikids_personalizado_final": {
        "text": "Here are the plans for Musikids Personalized.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather speak with an advisor, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_musikids_grupal_final": {
        "text": "Here are the plans for Musikids Group Classes.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather speak with an advisor, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_age_info_12a15": {
        "text": "Musiteens ages 12 to 15 are invited to an artistic adventure full of creativity and passion.\n\nOur Music, Dance, Theatre, and Visual Arts programs are designed to channel teenage energy into deeper artistic processes. Here, every Musiteen creates, explores, and strengthens their identity through art.\n\nMusic to compose their own adventures, dance to express powerful emotions, theatre to communicate, improvise, and build scenes, and visual arts to shape bold ideas.\n\nWhich art area would you like to explore with us?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Back to menu"
        ]
      },
      "presencial_musiteens_musica": {
        "text": "Musiteens Music: Learn singing or instruments and enjoy music.\n\nThis program is ideal for teens who want to sing or play instruments such as keyboard, guitar, or percussion. The classes are creative, practical, and designed so each student can learn at their own pace.\n\nLearn to sing with confidence\nExplore different instruments\nClear and highly practical classes\nDevelop your talent and love for music\n\nLearn more about how we teach here:\nhttps://drive.google.com/file/d/1tuU_2OeY2zz9su9NNGGq71cLpU71HsT9/view\n\nChoose the instrument you would like to learn:",
        "options": [
          "Piano/Keyboard",
          "Guitar",
          "Singing/Vocal Technique",
          "Violin",
          "Drums",
          "Cello",
          "Electric Bass",
          "Ukulele",
          "Wind Instruments",
          "Other",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musiteens_danza": {
        "text": "Musiteens Dance: dance, create, and enjoy.\n\nA program designed for teens full of energy and creativity. Here they explore different dance styles while having fun, improving technique, and expressing their unique style.\n\nMany styles to explore and enjoy\nCreative classes to express personality\nA motivating method built around rhythm\nWe foster a love for dance as art and communication\n\nLearn more about how we teach here:\nhttps://drive.google.com/file/d/1p5WyQADZIXpjFmVSPjj9lL_QwLDF5f7F/view\n\nChoose the dance style that interests you most:",
        "options": [
          "Latin Dances",
          "Classical Dance/Ballet",
          "Urban Dances",
          "Folk Dances",
          "Other",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musiteens_artes": {
        "text": "This program is designed to immerse teens in the world of visual arts, encouraging them to develop creativity through painting, drawing, sculpture, and more.\n\nThey explore traditional and contemporary techniques, strengthen creativity and personal style, and learn through enriching and dynamic activities that deepen artistic expression.\n\nLearn more about our Musiteens methodology here:\nhttps://drive.google.com/file/d/1UA2Ox8qFjQ6G1bqIZzbIcoINwshk90Xn/view\n\nWhich technique would you like to learn?",
        "options": [
          "Drawing",
          "Painting",
          "Crafts",
          "Mixed Techniques",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musiteens_teatro": {
        "text": "Musiteens Theatre: create, perform, and express your voice.\n\nA space for teens who want to explore acting, improvisation, body expression, and stage creation. Here they develop confidence, communication, and presence while building characters, scenes, and stories of their own.\n\nVoice and expression work\nImprovisation and character creation\nCreative classes to communicate ideas and emotions\nWe foster theatre as art, confidence, and teamwork\n\nIf you'd like to learn more about how we teach, you can also explore:\nhttps://musicala.github.io/musiedades/\n\nHere is the information about our on-site classes:\n\nPersonalized Classes: Close teacher support, ideal for advancing according to the student's pace, interests, and goals.\n\nGroup Classes for Musiteens: Groups of up to 6 students to learn, share, and strengthen artistic and social skills in a creative and safe environment.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musiteens_modalidades": {
        "text": "Here is the information about our on-site classes:\n\nPersonalized Classes: Close teacher support, ideal for advancing according to the student's pace, interests, and goals.\n\nGroup Classes for Musiteens: Groups of up to 6 students to learn, share, and strengthen artistic and social skills in a creative and safe environment.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_musiteens_personalizado_final": {
        "text": "Here are the plans for Musiteens Personalized.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather speak with an advisor, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_musiteens_grupal_final": {
        "text": "Here are the plans for Musiteens Group Classes.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather speak with an advisor, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_virtual": {
        "text": "Musicala Online Classes let you learn from anywhere in two ways: live classes with a teacher in real time or the Online Platform to progress at your own pace.\n\nWe work with Music, Dance, Theatre, and Visual Arts through a flexible and creative experience.\n\nTo guide you better, tell us the student's age:",
        "options": [
          "1 to 3",
          "4 to 6",
          "7 to 11",
          "12 to 15",
          "16 to 50",
          "50 and up",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_age_info": {
        "text": "Perfect. Now choose the art area for online classes:",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_arte_info": {
        "text": "Great. To continue, confirm the modality:",
        "options": [
          "Online",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_tipo_clase": {
        "text": "Great. What type of classes are you interested in?",
        "options": [
          "Group classes",
          "Personalized classes",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_info_modalidad": {
        "text": "All set. With this we can give you the exact info and help you continue the process.\n\nIf you want, write to us on WhatsApp and we'll continue from where you are.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_domicilio": {
        "text": "Musicala Home brings art right to your house with personalized, close, and pace-based classes.\n\nWe work with Music, Dance, Theatre, and Visual Arts through an experience tailored to each student and family.\n\nTo guide you better, tell us the student's age:",
        "options": [
          "1 to 3",
          "4 to 6",
          "7 to 11",
          "12 to 15",
          "16 to 50",
          "50 and up",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_age_info": {
        "text": "Perfect. Now choose the art area for at-home classes:",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_arte_info": {
        "text": "Great. To continue, confirm the modality:",
        "options": [
          "Musicala Home",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_tipo_clase": {
        "text": "Great. What type of classes are you interested in?",
        "options": [
          "Group classes",
          "Personalized classes",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_info_modalidad": {
        "text": "All set. With this we can give you the exact info and help you continue the process.\n\nIf you want, write to us on WhatsApp and we'll continue from where you are.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_otros_servicios": {
        "text": "Thanks for your interest in Musicala's additional services.\n\nHere are some options we offer:\n\nSpace rentals\nStore / accessories and instruments\nBusiness partnerships\nAcademic and social partnerships\n\nIf you already know which one interests you, the fastest way is to message us on WhatsApp and tell us:\n1) Which service do you need?\n2) Are you a company or an individual?\n\nYou can also go back to the menu or ask for an advisor to contact you.",
        "options": [
          "Main menu",
          "Continue with an advisor",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "flow_otros_asesor": {
        "text": "All set. We already have your details.\n\nOne of our team members will contact you shortly.\n\nIf you want to move faster, write to us on WhatsApp and tell us which service you need, and whether you are a company or an individual.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_age_info_16a40": {
        "text": "Musigrandes is our path for young people and adults ages 16 to 50 who want to experience art with more depth, freedom, and purpose.\n\nHere you can explore Music, Dance, Theatre, and Visual Arts in a process designed to strengthen technique, creativity, and self-expression.\n\nMusic to interpret, create, and connect with yourself.\nDance to train the body, energy, and presence.\nTheatre to communicate, improvise, and embody characters and ideas.\nVisual Arts to develop observation, technique, and a personal style.\n\nWhich art area would you like to explore with us?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Back to menu"
        ]
      },
      "presencial_age_info_40plus": {
        "text": "Musiadultos is our path for people ages 50 and up who want to learn, return to, or simply enjoy art at their own pace.\n\nWe create warm and meaningful experiences in Music, Dance, Theatre, and Visual Arts, taking care of the process, confidence, and enjoyment in every class.\n\nMusic to explore new sounds and skills.\nDance to activate the body, coordination, and expression.\nTheatre to strengthen memory, presence, and communication.\nVisual arts to create with calm, sensitivity, and freedom.\n\nWhich art area would you like to explore with us?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Back to menu"
        ]
      },
      "presencial_adultos_musica": {
        "text": "In our on-site music classes for young people and adults, we work on singing, instruments, technique, and musical expression in a personalized and motivating process.\n\nChoose the instrument you would like to learn:",
        "options": [
          "Piano/Keyboard",
          "Guitar",
          "Singing/Vocal Technique",
          "Violin",
          "Drums",
          "Cello",
          "Electric Bass",
          "Ukulele",
          "Wind Instruments",
          "Other",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_adultos_danza": {
        "text": "In our on-site dance classes for young people and adults, we work on technique, musicality, body awareness, and expressive freedom.\n\nChoose the style you would like to explore:",
        "options": [
          "Latin Dances",
          "Classical Dance/Ballet",
          "Urban Dances",
          "Folk Dances",
          "Other",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_adultos_artes": {
        "text": "In our on-site visual arts classes for young people and adults, we work on observation, technique, creativity, and the search for a personal style.\n\nWhich technique would you like to learn?",
        "options": [
          "Drawing",
          "Painting",
          "Crafts",
          "Mixed Techniques",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_adultos_teatro": {
        "text": "In our on-site theatre classes for young people and adults, we work on acting, voice, improvisation, body expression, and scene building.\n\nIt is a space to develop presence, confidence, creativity, and communication, whether you want to begin, explore, or go deeper into stage work.\n\nWhich modality would you like to learn more about?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_adultos_modalidades": {
        "text": "Here is the information about our on-site classes for young people and adults.\n\nPersonalized Classes: close teacher support to move forward according to your goals, pace, and artistic interests.\n\nGroup Classes: small groups to learn, share, and grow in community in a creative and caring environment.\n\nWhich modality would you like to explore?",
        "options": [
          "Personalized classes",
          "Group classes",
          "Talk to an advisor",
          "Back to menu"
        ]
      },
      "presencial_adultos_personalizado_final": {
        "text": "Here are the plans for On-site Personalized Classes.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather continue now, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "presencial_adultos_grupal_final": {
        "text": "Here are the plans for On-site Group Classes.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, methodology, and more.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather continue now, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_age_info_1a3": {
        "text": "Musibabies Home is our personalized artistic stimulation plan for little ones ages 1 to 3.\n\nWe work on music, dance, theatre through body expression, and visual arts in a loving, sensory, and creative experience at home.\n\nIf you'd like to learn more about what we do at these ages, you can explore it here:\nhttps://musicala.github.io/musiedades/\n\nWhich plan would you like to take at Musicala Home?",
        "options": [
          "4-class package",
          "8-class package",
          "12-class package",
          "24-class package",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_age_info_4a6": {
        "text": "Musicalitos Home brings artistic exploration into the home for children ages 4 to 6.\n\nThese classes are full of play, imagination, and discovery through Music, Dance, Theatre, and Visual Arts.\n\nWhich area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_age_info_7a11": {
        "text": "Musikids Home is designed for children ages 7 to 11 who want to learn art from home with more depth.\n\nHere they can explore Music, Dance, Theatre, and Visual Arts through personalized classes that blend technique, creativity, and enjoyment.\n\nWhich art area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_age_info_12a15": {
        "text": "Musiteens Home supports teens ages 12 to 15 in more conscious, creative, and expressive artistic processes.\n\nWe work on Music, Dance, Theatre, and Visual Arts at home with clear goals, flexibility, and close support.\n\nWhich art area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_age_info_16a50": {
        "text": "Musigrandes Home is our path for young people and adults ages 16 to 50 who want to learn art from home, at their own pace, with personalized guidance.\n\nYou can explore Music, Dance, Theatre, and Visual Arts in a process designed to strengthen technique, expression, and wellbeing.\n\nWhich art area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_age_info_50plus": {
        "text": "Musiadultos Home is designed for people ages 50 and up who want to learn, return to, or enjoy art with calm and confidence.\n\nFrom home, we work on Music, Dance, Theatre, and Visual Arts through close, meaningful experiences.\n\nWhich art area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_musicalitos_musica": {
        "text": "In Musicalitos Home, music is experienced through body, voice, and age-appropriate instruments.\n\nChildren strengthen rhythm, listening, coordination, and creativity in a close and playful experience.\n\nHere are the Musicala Home plans for this path.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_musicalitos_danza": {
        "text": "In Musicalitos Home, dance is explored through movement, body expression, and rhythm games created for this age.\n\nIt is a space to develop coordination, confidence, and artistic enjoyment from home.\n\nHere are the Musicala Home plans for this path.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_musicalitos_teatro": {
        "text": "In Musicalitos Home, theatre invites children to imagine, play, and tell stories with their body, voice, and emotions.\n\nWe strengthen communication, creativity, and confidence through a playful artistic process.\n\nHere are the Musicala Home plans for this path.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_musicalitos_artes": {
        "text": "In Musicalitos Home, visual arts open a space to create, explore materials, and express ideas freely.\n\nWe support creativity and fine motor development in a close and caring experience.\n\nHere are the Musicala Home plans for this path.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_home_musica": {
        "text": "In Musicala Home, music is taught through singing, instruments, technique, and enjoyment in a personalized process.\n\nChoose the instrument you would like to learn:",
        "options": [
          "Piano/Keyboard",
          "Guitar",
          "Singing/Vocal Technique",
          "Violin",
          "Drums",
          "Cello",
          "Electric Bass",
          "Ukulele",
          "Wind Instruments",
          "Other",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_home_danza": {
        "text": "In Musicala Home, dance is experienced through technique, musicality, expression, and enjoyment of movement.\n\nChoose the dance style that interests you most:",
        "options": [
          "Latin Dances",
          "Classical Dance/Ballet",
          "Urban Dances",
          "Folk Dances",
          "Other",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_home_artes": {
        "text": "In Musicala Home, visual arts combine observation, technique, creativity, and personal style.\n\nWhich technique would you like to learn?",
        "options": [
          "Drawing",
          "Painting",
          "Crafts",
          "Mixed Techniques",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_home_teatro": {
        "text": "In Musicala Home, theatre is experienced through acting, voice, improvisation, and body expression.\n\nIt is a personalized path to strengthen presence, communication, creativity, and confidence from home.\n\nHere are the Musicala Home plans for this path.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "domicilio_home_final": {
        "text": "Here are the plans for Musicala Home Personalized Classes.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, coverage, pricing, and methodology.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather continue now, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_age_info_1a3": {
        "text": "Musibabies Online is an artistic stimulation experience for little ones ages 1 to 3 that integrates music, dance, theatre through body expression, and visual arts.\n\nWe create loving and highly guided live sessions to support families at home.\n\nIf you'd like to learn more about these ages, you can explore it here:\nhttps://musicala.github.io/musiedades/\n\nHow would you like to experience this path?",
        "options": [
          "Live classes",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_age_info_4a6": {
        "text": "Musicalitos Online invites children ages 4 to 6 to discover art from home through play, imagination, and movement.\n\nWe work with Music, Dance, Theatre, and Visual Arts through close and creative proposals.\n\nWhich area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_age_info_7a11": {
        "text": "Musikids Online supports children ages 7 to 11 in deeper and more motivating artistic processes from anywhere.\n\nHere they can explore Music, Dance, Theatre, and Visual Arts through live classes or self-paced support.\n\nWhich art area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_age_info_12a15": {
        "text": "Musiteens Online is designed for teens ages 12 to 15 who want to explore art with more autonomy, creativity, and support.\n\nWe work on Music, Dance, Theatre, and Visual Arts through dynamic online experiences adapted to their goals.\n\nWhich art area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_age_info_16a50": {
        "text": "Musigrandes Online is our path for young people and adults ages 16 to 50 who want to learn art with flexibility, depth, and guidance from anywhere.\n\nYou can explore Music, Dance, Theatre, and Visual Arts through live classes or self-paced processes.\n\nWhich art area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_age_info_50plus": {
        "text": "Musiadultos Online is designed for people ages 50 and up who want to learn, return to, or enjoy art with flexibility, closeness, and confidence.\n\nFrom anywhere, we work on Music, Dance, Theatre, and Visual Arts through clear and human online paths.\n\nWhich art area would you like to explore?",
        "options": [
          "Music",
          "Dance",
          "Theatre",
          "Visual Arts",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_musicalitos_musica": {
        "text": "In Musicalitos Online, music is experienced through body, voice, and age-appropriate instruments.\n\nWe strengthen rhythm, listening, and creativity in a close and playful experience.\n\nHow would you like to experience this path?",
        "options": [
          "Live classes",
          "Online platform",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_musicalitos_danza": {
        "text": "In Musicalitos Online, dance is explored through movement, body expression, and rhythm games adapted to this age.\n\nIt is a space to develop coordination, confidence, and artistic enjoyment from home.\n\nHow would you like to experience this path?",
        "options": [
          "Live classes",
          "Online platform",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_musicalitos_teatro": {
        "text": "In Musicalitos Online, theatre invites children to imagine, play, and tell stories with the voice, body, and emotions.\n\nWe strengthen creativity, communication, and confidence in a playful process.\n\nHow would you like to experience this path?",
        "options": [
          "Live classes",
          "Online platform",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_musicalitos_artes": {
        "text": "In Musicalitos Online, visual arts create a space to experiment with materials and express ideas freely.\n\nWe support creativity and fine motor development with clear at-home activities.\n\nHow would you like to experience this path?",
        "options": [
          "Live classes",
          "Online platform",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_online_teatro": {
        "text": "In our online theatre classes, we work on acting, voice, improvisation, and body expression through close and creative processes.\n\nIt is an ideal path to strengthen presence, communication, and confidence from anywhere.\n\nHow would you like to experience this path?",
        "options": [
          "Live classes",
          "Online platform",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_producto_selector": {
        "text": "Online, you have two ways to learn with Musicala.\n\nLive classes: real-time sessions with a teacher, feedback, and close support.\n\nOnline platform: access to progress at your own pace, review, and sustain your artistic process from anywhere.\n\nWhich one interests you most?",
        "options": [
          "Live classes",
          "Online platform",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_online_musica": {
        "text": "In our online music classes, we work on singing, instruments, technique, and creativity with close support and clear processes.\n\nChoose the instrument you would like to learn:",
        "options": [
          "Piano/Keyboard",
          "Guitar",
          "Singing/Vocal Technique",
          "Violin",
          "Drums",
          "Cello",
          "Electric Bass",
          "Ukulele",
          "Wind Instruments",
          "Other",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_online_danza": {
        "text": "In our online dance classes, we work on technique, musicality, expression, and body training through dynamic sessions.\n\nChoose the dance style that interests you most:",
        "options": [
          "Latin Dances",
          "Classical Dance/Ballet",
          "Urban Dances",
          "Folk Dances",
          "Other",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_online_artes": {
        "text": "In our online visual arts classes, we combine technique, observation, and creativity so each student can progress with guidance and freedom.\n\nWhich technique would you like to learn?",
        "options": [
          "Drawing",
          "Painting",
          "Crafts",
          "Mixed Techniques",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_final_en_vivo": {
        "text": "Here are the plans for Live Online Classes.\n\nBefore speaking with our team, we invite you to explore our FAQ. There you'll find key information about schedules, pricing, and methodology.\n\nIf you'd like to explore other options, you can go back to the menu. And if you'd rather continue now, you can also message us on WhatsApp.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_plataforma_planes": {
        "text": "Musicala Online Platform lets you progress at your own pace, review content, and sustain your artistic process from anywhere.\n\nPlans for new students:\n- 1 month: $56,000\n- 2 months: $110,000\n- 3 months: $160,000\n- 6 months: $322,000\n- 12 months: $454,000\n\nWhich plan would you like to take?",
        "options": [
          "Online Platform 1 month",
          "Online Platform 2 months",
          "Online Platform 3 months",
          "Online Platform 6 months",
          "Online Platform 12 months",
          "Talk on WhatsApp",
          "Back to menu"
        ]
      },
      "virtual_final_plataforma": {
        "text": "Perfect. With this we can guide you better about the Online Platform.\n\nBefore speaking with our team, we invite you to review our FAQ. And if you'd like to continue now, you can message us on WhatsApp to complete the process.\n\nIf you'd like to explore other options, you can also go back to the menu.",
        "options": [
          "Talk on WhatsApp",
          "Back to menu"
        ]
      }
    }
  }
};

export default FLOW_I18N;
