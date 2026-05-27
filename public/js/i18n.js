(function () {
  const STRINGS = {
    sv: {
      'app.brand': 'Gemenskap',
      'lang.swedish': 'Svenska',
      'lang.english': 'English',
      'nav.home': 'Hem',
      'nav.community': 'Community',
      'nav.events': 'Event',
      'nav.messages': 'Meddelanden',
      'nav.you_are_here': 'Du är här',
      'common.next': 'Nästa',
      'common.back': 'Tillbaka',
      'common.cancel': 'Avbryt',
      'common.save': 'Spara',
      'common.send': 'Skicka',
      'common.continue': 'Fortsätt',
      'common.loading': 'Laddar…',
      'common.logout': 'Logga ut',
      'common.profile': 'Min profil',
      'common.optional': '(valfritt)',
      'common.you': 'du',
      'common.text_size': 'Textstorlek',
      'common.text_smaller': 'Mindre text',
      'common.text_normal': 'Normal text',
      'common.text_larger': 'Större text',
      'common.text_largest': 'Störst text',
      'common.confirm_ok': 'Ja, fortsätt',
      'common.confirm_cancel': 'Avbryt',
      'landing.title': 'Hitta nya vänner och aktiviteter',
      'landing.subtitle':
        'Gemenskap hjälper dig hitta små grupper i din stad – för promenader, fika, hantverk och mycket mer.',
      'landing.feature1': 'Små grupper, max 40 personer',
      'landing.feature2': 'Vi föreslår grupper utifrån dina intressen',
      'landing.feature3': 'Inga annonser. Lugnt och enkelt.',
      'landing.cta_login': 'Logga in eller skapa konto',
      'landing.reassurance': 'Helt gratis. Inga annonser. Du kan lämna när du vill.',
      'landing.cta_how': 'Så här fungerar det',
      'login.step1.title': 'Skriv in ditt mobilnummer',
      'login.step1.help': 'Vi skickar en kod via SMS. Det kostar inget.',
      'login.phone_label': 'Mobilnummer',
      'login.phone_placeholder': '070-123 45 67',
      'login.send_code': 'Skicka kod',
      'login.step2.title': 'Skriv in koden vi skickat',
      'login.step2.help': 'Sex siffror. Koden gäller i 10 minuter.',
      'login.code_label': 'Kod från SMS',
      'login.verify': 'Logga in',
      'login.resend': 'Skicka ny kod',
      'login.resend_in': 'Skicka ny kod om {{s}} sekunder',
      'login.dev_code': 'Demo-kod (visas eftersom ingen SMS-tjänst används): ',
      'login.step_indicator_1': 'Steg 1 – Nummer',
      'login.step_indicator_2': 'Steg 2 – Kod',
      'login.step_indicator_3': 'Steg 3 – Klar',
      'onboarding.title': 'Berätta lite om dig',
      'onboarding.subtitle':
        'Vi använder det för att föreslå grupper som passar dig. Du kan ändra svaren när du vill.',
      'onboarding.name_label': 'Vad ska vi kalla dig?',
      'onboarding.name_help': 'Förnamn räcker.',
      'onboarding.city_label': 'Vilken stad bor du i?',
      'onboarding.city_help': 'Vi visar grupper nära dig.',
      'onboarding.interests_label': 'Vad tycker du om att göra?',
      'onboarding.interests_help': 'Välj bland förslagen — vi använder dem för att placera dig i rätt grupp.',
      'onboarding.assigning_title': 'Vi hittar en grupp åt dig …',
      'onboarding.assigning_help': 'Vår matchning väljer den grupp som passar bäst utifrån dina intressen och din stad.',
      'onboarding.no_match_title': 'Vi hittade ingen grupp som passar än',
      'onboarding.no_match_help': 'Försök lägga till några intressen till så letar vi igen.',
      'onboarding.back_to_interests': 'Tillbaka och välj fler intressen',
      'onboarding.detect_location': 'Hitta min plats',
      'onboarding.detecting_location': 'Letar…',
      'onboarding.location_found': 'Vi hittade: {{city}}',
      'onboarding.location_failed': 'Vi kunde inte hitta din plats. Skriv in din stad istället.',
      'onboarding.location_denied': 'Du behöver godkänna platsåtkomst i webbläsaren. Skriv in din stad istället.',
      'onboarding.suggestions_title': 'Vi har tre förslag åt dig',
      'onboarding.suggestions_help':
        'Välj en grupp att gå med i. Du kan byta senare.',
      'onboarding.join_button': 'Gå med här',
      'onboarding.try_others': 'Visa andra förslag',
      'onboarding.shared_interests': 'Delar med dig: ',
      'onboarding.distance_same': 'I din stad',
      'onboarding.distance_nearby': 'Nära dig ({{km}} km)',
      'onboarding.distance_medium': '{{km}} km bort',
      'onboarding.distance_far': 'Långt bort ({{km}} km)',
      'onboarding.members': '{{n}} av {{max}} medlemmar',
      'onboarding.no_suggestions':
        'Vi hittar inga förslag just nu. Lägg till fler intressen så letar vi igen.',
      'onboarding.weak_match_title': 'Vi hittade ingen perfekt grupp',
      'onboarding.weak_match_body':
        'Här är några grupper som ändå kan passa, eller skapa en ny som matchar exakt det du gillar.',
      'onboarding.empty_match_title': 'Vi hittade inga grupper just nu',
      'onboarding.empty_match_body':
        'Det finns ingen befintlig grupp som passar dina intressen. Vill du skapa en?',
      'onboarding.create_group_help':
        'Vi gör en grupp åt dig baserad på dina intressen och stad. Du blir första medlem och kan bjuda in fler.',
      'onboarding.create_group_button': 'Skapa en ny grupp åt mig',
      'onboarding.create_group_no_interests':
        'Lägg till minst ett intresse för att vi ska kunna skapa en grupp åt dig.',
      'onboarding.preview_title': 'Förslag till ny grupp',
      'onboarding.preview_help': 'Du kan ändra namnet och beskrivningen om du vill.',
      'onboarding.preview_name_label': 'Gruppens namn',
      'onboarding.preview_description_label': 'Beskrivning',
      'onboarding.preview_city_label': 'Stad',
      'onboarding.preview_interests_label': 'Intressen',
      'onboarding.preview_create': 'Skapa gruppen',
      'onboarding.preview_cancel': 'Avbryt',
      'home.welcome': 'Hej {{name}}!',
      'home.next_event': 'Ditt nästa event',
      'home.no_events': 'Inga kommande event just nu. Skapa ett från din community-sida.',
      'home.no_events_hint': 'Inga event ännu — kanske vill du skapa ett första?',
      'home.recent_posts': 'Senast i ditt community',
      'home.no_posts': 'Inga inlägg ännu. Bli först att skriva något!',
      'home.no_posts_hint': 'Inga inlägg här ännu. Skriv det första — det betyder mycket för gruppen.',
      'home.go_community': 'Gå till community',
      'home.no_community':
        'Du är inte med i något community ännu — börja med att utforska.',
      'home.find_community': 'Hitta ett community',
      'home.browse_communities': 'Utforska communities',
      'about.title': 'Om Gemenskap',
      'about.lead':
        'Gemenskap är en mötesplats för seniorer som vill träffa nya människor, hitta sammanhang och göra saker tillsammans — promenader, fika, bokcirklar, schackspel eller helt enkelt ett samtal som lyser upp dagen.',
      'about.why_title': 'Varför vi finns',
      'about.why_body':
        'Ensamhet är ett växande folkhälsoproblem, särskilt efter pensionen när vardagens naturliga möten blir färre. Forskning visar att regelbundna sociala kontakter bidrar lika mycket till hälsan som motion och bra kost. Vi byggde Gemenskap för att göra steget till en ny grupp så enkelt som möjligt — utan krångliga inloggningar, utan algoritmer som vill ha din uppmärksamhet, och utan reklam.',
      'about.how_title': 'Så funkar det',
      'about.how_item_1':
        'Du berättar vad du tycker om — promenader, trädgård, musik, kortspel — och i vilken stad du bor.',
      'about.how_item_2':
        'Vår modell hittar en grupp på högst 40 personer i din stad som delar dina intressen.',
      'about.how_item_3':
        'Du läser inlägg, anmäler dig till event och skriver med andra medlemmar precis när du har tid.',
      'about.how_item_4':
        'Passar inte gruppen? Tryck "Lämna och få en ny grupp" så hittar vi en annan som matchar bättre.',
      'about.values_title': 'Det här lovar vi',
      'about.values_body':
        'Inga annonser. Inga delade data till tredje part. Stora texter, tydliga knappar och tålamod med dem som är nya med appar. Du bestämmer själv när och hur ofta du loggar in — Gemenskap väntar.',
      'about.signoff':
        'Vi tror på att riktiga vänskaper börjar med små samtal. Välkommen.',
      'tips.close_label': 'Stäng tips',
      'tips.first_event': 'Detta är ditt första event! Tryck på "Jag kommer" för att tacka ja.',
      'tips.first_post': 'Tryck "Lägg upp inlägg" för att dela med gruppen. Du kan ändra eller ta bort senare.',
      'tips.first_member_view': 'Tryck på en medlem för att se profilen eller skicka ett meddelande.',
      'tips.first_message_thread': 'Skriv ditt meddelande nedan. Personen ser det inom några sekunder.',
      'tips.first_community': 'Bra val! Tryck på fliken Event för att se vad som händer härnäst.',
      'community.tab_posts': 'Inlägg',
      'community.tab_members': 'Medlemmar',
      'community.tab_events': 'Event',
      'community.write_post_label': 'Skriv ett inlägg',
      'community.write_post_help': 'Andra i gruppen ser detta. Tryck Ctrl + Enter för att skicka.',
      'community.post_button': 'Lägg upp inlägg',
      'community.leave': 'Lämna och få en ny grupp',
      'community.leave_confirm':
        'Är du säker att du vill lämna? Vi hittar direkt en ny grupp åt dig.',
      'community.switch_confirm':
        'Vill du byta grupp? Du lämnar "{{from}}" och vi tilldelar dig en ny grupp som matchar dina intressen.',
      'community.switched_from':
        'Du har bytt grupp — välkommen till "{{to}}"! (Du lämnade "{{from}}".)',
      'community.switched_no_from':
        'Du har bytt grupp — välkommen till "{{to}}"!',
      'community.city_mismatch':
        'Den här gruppen ligger i {{groupCity}}, inte i {{userCity}}. Vi valde den eftersom dina intressen matchade den bäst — du kan byta till en annan grupp om du vill ha något närmare.',
      'community.interests_mismatch':
        'Dina intressen matchar inte längre gruppen så bra. Vill du hitta en grupp som passar bättre?',
      'community.interests_mismatch_button': 'Hitta ny grupp',
      'community.member_count': '{{n}} av {{max}} medlemmar',
      'community.full_warning':
        'Den här gruppen är full. Vi hjälper dig hitta en plats någon annanstans.',
      'community.you_created_this': 'Du skapade den här gruppen',
      'community.creator_label': 'Du skapade',
      'community.creator_rejoin': 'Du skapade den här gruppen — gå med igen?',
      'community.rejoin_button': 'Gå med igen',
      'community.leave_destroy_warning':
        'Du är sista medlemmen i "{{name}}". Om du lämnar tas gruppen bort permanent — alla inlägg och event försvinner. Vill du verkligen lämna?',
      'community.switcher_label': 'Mina grupper:',
      'events.title': 'Kommande event',
      'events.create_title': 'Skapa nytt event',
      'events.event_title': 'Vad heter eventet?',
      'events.event_date': 'När?',
      'events.event_location': 'Platsnamn',
      'events.event_location_help': 'T.ex. "Café Husaren" eller "Stadsbiblioteket"',
      'events.event_address': 'Adress',
      'events.event_address_help': 'Gatuadress så andra hittar dit',
      'events.event_description': 'Beskrivning',
      'events.open_map': 'Visa på karta',
      'events.create_button': 'Skapa event',
      'events.rsvp_going': 'Jag kommer',
      'events.rsvp_maybe': 'Kanske',
      'events.rsvp_no': 'Kan inte',
      'events.going_count': '{{n}} kommer',
      'messages.title': 'Meddelanden',
      'messages.no_threads':
        'Inga konversationer ännu. Tryck på "Starta ny konversation" för att skriva till någon i din grupp.',
      'messages.start_new': 'Starta ny konversation',
      'messages.pick_member_title': 'Välj en medlem att skriva till',
      'messages.pick_member_help': 'Du ser medlemmarna i de grupper du tillhör. Tryck på en person för att börja skriva.',
      'messages.search_member_label': 'Sök medlem',
      'messages.search_member_placeholder': 'Sök på namn …',
      'messages.search_count': 'Visar {{n}} av {{total}}',
      'messages.search_no_match': 'Ingen medlem matchar din sökning. Försök med ett annat namn.',
      'messages.no_members_to_message':
        'Det finns inga andra medlemmar att skriva till just nu. Gå med i en grupp först.',
      'messages.send_placeholder': 'Skriv ditt meddelande…',
      'messages.send': 'Skicka',
      'messages.block_user': 'Blockera den här användaren',
      'messages.block_confirm':
        'Är du säker på att du vill blockera {{name}}? Personen kan inte skicka fler meddelanden till dig.',
      'messages.block_done': 'Användaren är blockerad. Du kommer inte att se fler meddelanden från personen.',
      'messages.report_user': 'Rapportera användaren',
      'messages.pii_warning':
        '⚠️ Det ser ut som att du delar personlig information (telefonnummer eller bankuppgifter). Dela aldrig sådant i meddelanden — det kan användas för bedrägeri. Vill du ändå skicka?',
      'messages.scam_help_title': 'Säkerhetstips',
      'messages.scam_help_body':
        'Dela aldrig telefonnummer, kontonummer, BankID-koder eller personnummer i meddelanden. Om någon ber om pengar eller hjälp att flytta pengar — rapportera och blockera direkt.',
      'profile.title': 'Min profil',
      'profile.bio_label': 'Berätta om dig själv',
      'profile.bio_help': 'Detta syns för andra medlemmar.',
      'profile.save': 'Spara ändringar',
      'profile.replay_tutorial': 'Visa introduktionen igen',
      'profile.communities_title': 'Mina communities',
      'profile.created_title': 'Grupper du skapat',
      'profile.created_help': 'Grupperna du startat finns alltid här — även om du lämnat dem.',
      'profile.created_member': 'Medlem',
      'profile.created_left': 'Lämnad',
      'profile.privacy_title': 'Dina rättigheter',
      'profile.export_data': 'Ladda ner mina data',
      'profile.export_help':
        'Du har rätt att få en kopia av all data vi lagrar om dig (GDPR artikel 20).',
      'profile.export_started': 'Filen laddas ner inom kort.',
      'profile.blocked_title': 'Blockerade användare',
      'profile.blocked_empty': 'Du har inte blockerat någon.',
      'profile.unblock': 'Häv blockering',
      'common.report': 'Rapportera',
      'report.title': 'Rapportera innehåll',
      'report.help':
        'Berätta kort vad som är fel. Vi tar varje anmälan på allvar.',
      'report.reason_placeholder': 'T.ex. "Den här användaren bad om pengar"',
      'report.submit': 'Skicka rapport',
      'report.cancel': 'Avbryt',
      'report.submitted': 'Tack, vi har tagit emot din rapport.',
      'report.post_button': 'Rapportera inlägg',
      'profile.member_since': 'Medlem sedan {{date}}',
      'tutorial.title': 'Välkommen till Gemenskap',
      'tutorial.step1.title': 'Du är här – Hem',
      'tutorial.step1.body':
        'Här ser du nästa event och senaste inläggen från din grupp.',
      'tutorial.step2.title': 'Community',
      'tutorial.step2.body':
        'Skriv inlägg, se medlemmar och planera aktiviteter med din grupp.',
      'tutorial.step3.title': 'Event',
      'tutorial.step3.body':
        'Alla kommande aktiviteter du kan gå på, samlade på ett ställe.',
      'tutorial.step4.title': 'Meddelanden',
      'tutorial.step4.body':
        'Skicka direktmeddelanden till andra medlemmar – privat och tryggt.',
      'tutorial.next': 'Nästa',
      'tutorial.done': 'Jag förstår',
      'tutorial.skip': 'Hoppa över introduktionen',
      'interests.cat_outdoor': 'Natur & utomhus',
      'interests.cat_sport': 'Sport & spel',
      'interests.cat_create': 'Skapa & uttrycka',
      'interests.cat_culture': 'Böcker & kultur',
      'interests.cat_food': 'Mat & sällskap',
      'interests.cat_health': 'Hälsa & rörelse',
      'errors.network':
        'Vi får inte tag på internet just nu. Kontrollera din anslutning och försök igen.',
      'errors.generic':
        'Något blev inte rätt. Vänta en stund och försök igen, så löser det sig oftast.',
      'browse.title': 'Utforska communities',
      'browse.subtitle': 'Alla grupper som finns. Gå med i en som passar dig.',
      'browse.join': 'Gå med',
      'browse.already_member': 'Du är redan med',
      'browse.full': 'Full',
      'browse.go_to': 'Gå till community',
      'browse.button': 'Utforska alla communities',
      'browse.filter_search_label': 'Sök efter namn',
      'browse.filter_search_placeholder': 'T.ex. "promenad" eller "schack"',
      'browse.filter_city_label': 'Stad',
      'browse.filter_city_any': 'Alla städer',
      'browse.filter_interest_label': 'Intresse',
      'browse.filter_interest_any': 'Alla intressen',
      'browse.filter_near_me': 'Endast nära mig (≤ 80 km)',
      'browse.filter_available': 'Endast med lediga platser',
      'browse.filter_clear': 'Rensa filter',
      'browse.filter_count': '{{n}} av {{total}} grupper visas',
      'browse.filter_no_match': 'Ingen grupp matchade filtren. Prova att rensa något.',
      'profile.upload_photo': 'Lägg till foto',
      'profile.change_photo': 'Byt foto',
      'profile.remove_photo': 'Ta bort foto',
      'profile.remove_photo_confirm':
        'Vill du ta bort din profilbild? Andra kommer att se dina initialer istället.',
      'profile.photo_removed': 'Fotot är borttaget.',
      'profile.photo_help': 'Välj en bild från din dator eller telefon.',
      'profile.photo_saved': 'Fotot är sparat!',
      'profile.delete_account': 'Radera mitt konto',
      'profile.delete_confirm': 'Är du helt säker? All din information raderas permanent och kan inte återställas.',
      'profile.delete_confirm_button': 'Ja, radera mitt konto',
      'profile.deleted': 'Ditt konto är raderat. Vi hoppas att du trivdes.',
      'profile.settings_title': 'Inställningar',
      'time.now': 'just nu',
      'time.min_ago': 'för {{n}} min sedan',
      'time.hour_ago': 'för {{n}} tim sedan',
      'time.yesterday': 'igår',
      'time.days_ago': 'för {{n}} dagar sedan',
    },
    en: {
      'app.brand': 'Gemenskap',
      'lang.swedish': 'Svenska',
      'lang.english': 'English',
      'nav.home': 'Home',
      'nav.community': 'Community',
      'nav.events': 'Events',
      'nav.messages': 'Messages',
      'nav.you_are_here': 'You are here',
      'common.next': 'Next',
      'common.back': 'Back',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.send': 'Send',
      'common.continue': 'Continue',
      'common.loading': 'Loading…',
      'common.logout': 'Log out',
      'common.profile': 'My profile',
      'common.optional': '(optional)',
      'common.you': 'you',
      'common.text_size': 'Text size',
      'common.text_smaller': 'Smaller text',
      'common.text_normal': 'Normal text',
      'common.text_larger': 'Larger text',
      'common.text_largest': 'Largest text',
      'common.confirm_ok': 'Yes, continue',
      'common.confirm_cancel': 'Cancel',
      'landing.title': 'Find new friends and activities',
      'landing.subtitle':
        'Gemenskap helps you find small groups in your city – for walks, coffee, crafts and more.',
      'landing.feature1': 'Small groups, max 40 people',
      'landing.feature2': 'We suggest groups based on your interests',
      'landing.feature3': 'No ads. Calm and simple.',
      'landing.cta_login': 'Log in or create account',
      'landing.reassurance': 'Completely free. No ads. You can leave any time.',
      'landing.cta_how': 'How it works',
      'login.step1.title': 'Enter your mobile number',
      'login.step1.help': 'We send a code via SMS. It is free.',
      'login.phone_label': 'Mobile number',
      'login.phone_placeholder': '070-123 45 67',
      'login.send_code': 'Send code',
      'login.step2.title': 'Enter the code we sent',
      'login.step2.help': 'Six digits. The code is valid for 10 minutes.',
      'login.code_label': 'Code from SMS',
      'login.verify': 'Log in',
      'login.resend': 'Send new code',
      'login.resend_in': 'Send new code in {{s}} seconds',
      'login.dev_code': 'Demo code (shown because no SMS service is used): ',
      'login.step_indicator_1': 'Step 1 – Number',
      'login.step_indicator_2': 'Step 2 – Code',
      'login.step_indicator_3': 'Step 3 – Done',
      'onboarding.title': 'Tell us a little about you',
      'onboarding.subtitle':
        'We use it to suggest groups that fit you. You can change your answers any time.',
      'onboarding.name_label': 'What should we call you?',
      'onboarding.name_help': 'A first name is enough.',
      'onboarding.city_label': 'Which city do you live in?',
      'onboarding.city_help': 'We show groups near you.',
      'onboarding.interests_label': 'What do you enjoy doing?',
      'onboarding.interests_help': 'Pick from the suggestions — we use them to place you in the right group.',
      'onboarding.assigning_title': 'Finding a group for you …',
      'onboarding.assigning_help': 'Our matcher picks the group that fits your interests and city best.',
      'onboarding.no_match_title': 'We could not find a matching group yet',
      'onboarding.no_match_help': 'Try adding a few more interests and we will look again.',
      'onboarding.back_to_interests': 'Back and add more interests',
      'onboarding.detect_location': 'Find my location',
      'onboarding.detecting_location': 'Searching…',
      'onboarding.location_found': 'We found: {{city}}',
      'onboarding.location_failed': 'We could not find your location. Please type your city instead.',
      'onboarding.location_denied': 'You need to allow location access in your browser. Please type your city instead.',
      'onboarding.suggestions_title': 'We have three suggestions for you',
      'onboarding.suggestions_help':
        'Pick a group to join. You can change later.',
      'onboarding.join_button': 'Join this one',
      'onboarding.try_others': 'Show other suggestions',
      'onboarding.shared_interests': 'Shared with you: ',
      'onboarding.distance_same': 'In your city',
      'onboarding.distance_nearby': 'Near you ({{km}} km)',
      'onboarding.distance_medium': '{{km}} km away',
      'onboarding.distance_far': 'Far away ({{km}} km)',
      'onboarding.members': '{{n}} of {{max}} members',
      'onboarding.no_suggestions':
        'We could not find any suggestions yet. Add more interests and we will look again.',
      'onboarding.weak_match_title': 'No perfect match yet',
      'onboarding.weak_match_body':
        'Here are some groups that may still fit, or create a new one that matches exactly what you like.',
      'onboarding.empty_match_title': 'No groups found yet',
      'onboarding.empty_match_body':
        'There is no existing group that fits your interests. Would you like to create one?',
      'onboarding.create_group_help':
        'We will draft a group for you based on your interests and city. You become the first member and can invite others.',
      'onboarding.create_group_button': 'Create a new group for me',
      'onboarding.create_group_no_interests':
        'Add at least one interest so we can create a group for you.',
      'onboarding.preview_title': 'New group suggestion',
      'onboarding.preview_help': 'You can change the name and description if you like.',
      'onboarding.preview_name_label': 'Group name',
      'onboarding.preview_description_label': 'Description',
      'onboarding.preview_city_label': 'City',
      'onboarding.preview_interests_label': 'Interests',
      'onboarding.preview_create': 'Create the group',
      'onboarding.preview_cancel': 'Cancel',
      'home.welcome': 'Hi {{name}}!',
      'home.next_event': 'Your next event',
      'home.no_events': 'No upcoming events yet. Create one from your community page.',
      'home.no_events_hint': 'No events yet — would you like to create the first one?',
      'home.recent_posts': 'Latest in your community',
      'home.no_posts': 'No posts yet. Be the first to write something!',
      'home.no_posts_hint': 'No posts here yet. Write the first one — it means a lot to the group.',
      'home.go_community': 'Go to community',
      'home.no_community':
        'You are not in a community yet — start by exploring.',
      'home.find_community': 'Find a community',
      'home.browse_communities': 'Explore communities',
      'about.title': 'About Gemenskap',
      'about.lead':
        'Gemenskap is a place for older adults who want to meet new people, find belonging, and do things together — walks, coffee, book clubs, chess, or simply a conversation that brightens the day.',
      'about.why_title': 'Why we exist',
      'about.why_body':
        'Loneliness is a growing public health issue, especially after retirement when the everyday meetings of working life fall away. Research shows that regular social contact contributes as much to our health as exercise and good food. We built Gemenskap to make the step into a new group as easy as possible — no complicated logins, no algorithms competing for your attention, and no advertising.',
      'about.how_title': 'How it works',
      'about.how_item_1':
        'You tell us what you enjoy — walking, gardening, music, card games — and which city you live in.',
      'about.how_item_2':
        'Our model finds a group of at most 40 people in your city who share your interests.',
      'about.how_item_3':
        'You read posts, sign up for events, and write to other members whenever you have time.',
      'about.how_item_4':
        "Group doesn't suit you? Tap \"Leave and get a new group\" and we'll find a better match.",
      'about.values_title': 'What we promise',
      'about.values_body':
        'No advertisements. No data shared with third parties. Large text, clear buttons, and patience for those new to apps. You decide when and how often to log in — Gemenskap waits for you.',
      'about.signoff':
        'We believe real friendships start with small conversations. Welcome.',
      'tips.close_label': 'Close tip',
      'tips.first_event': 'This is your first event! Tap "I am coming" to RSVP.',
      'tips.first_post': 'Tap "Post" to share with the group. You can edit or delete later.',
      'tips.first_member_view': 'Tap a member to see their profile or send a message.',
      'tips.first_message_thread': 'Type your message below. The other person will see it in a few seconds.',
      'tips.first_community': 'Great choice! Tap the Events tab to see what is coming up.',
      'community.tab_posts': 'Posts',
      'community.tab_members': 'Members',
      'community.tab_events': 'Events',
      'community.write_post_label': 'Write a post',
      'community.write_post_help': 'Others in the group will see this. Press Ctrl + Enter to send.',
      'community.post_button': 'Publish post',
      'community.leave': 'Leave and get a new group',
      'community.leave_confirm':
        'Are you sure you want to leave? We will assign a new group right away.',
      'community.switch_confirm':
        'Do you want to switch groups? You will leave "{{from}}" and we will assign you a new group that matches your interests.',
      'community.switched_from':
        'You have switched groups — welcome to "{{to}}"! (You left "{{from}}".)',
      'community.switched_no_from':
        'You have switched groups — welcome to "{{to}}"!',
      'community.city_mismatch':
        'This group is in {{groupCity}}, not in {{userCity}}. We picked it because your interests matched it best — you can switch to another group if you want one closer.',
      'community.interests_mismatch':
        'Your interests no longer match this group well. Want to find a better fit?',
      'community.interests_mismatch_button': 'Find a new group',
      'community.member_count': '{{n}} of {{max}} members',
      'community.full_warning':
        'This group is full. We will help you find a place somewhere else.',
      'community.you_created_this': 'You created this group',
      'community.creator_label': 'You created',
      'community.creator_rejoin': 'You created this group — join again?',
      'community.rejoin_button': 'Join again',
      'community.leave_destroy_warning':
        'You are the last member of "{{name}}". If you leave, the group is permanently deleted — all posts and events will disappear. Are you sure you want to leave?',
      'community.switcher_label': 'My groups:',
      'events.title': 'Upcoming events',
      'events.create_title': 'Create a new event',
      'events.event_title': 'What is the event called?',
      'events.event_date': 'When?',
      'events.event_location': 'Place name',
      'events.event_location_help': 'E.g. "Café Husaren" or "The City Library"',
      'events.event_address': 'Address',
      'events.event_address_help': 'Street address so others can find it',
      'events.event_description': 'Description',
      'events.open_map': 'Show on map',
      'events.create_button': 'Create event',
      'events.rsvp_going': 'I am coming',
      'events.rsvp_maybe': 'Maybe',
      'events.rsvp_no': 'Cannot make it',
      'events.going_count': '{{n}} coming',
      'messages.title': 'Messages',
      'messages.start_new': 'Start a new conversation',
      'messages.pick_member_title': 'Pick someone to write to',
      'messages.pick_member_help': 'These are the members of groups you belong to. Tap a person to start writing.',
      'messages.search_member_label': 'Search member',
      'messages.search_member_placeholder': 'Search by name …',
      'messages.search_count': 'Showing {{n}} of {{total}}',
      'messages.search_no_match': 'No member matches your search. Try another name.',
      'messages.no_members_to_message':
        'There are no other members to message right now. Join a group first.',
      'messages.no_threads':
        'No conversations yet. Tap "Start a new conversation" to write to someone in your group.',
      'messages.send_placeholder': 'Type your message…',
      'messages.send': 'Send',
      'messages.block_user': 'Block this user',
      'messages.block_confirm':
        'Are you sure you want to block {{name}}? They will not be able to message you anymore.',
      'messages.block_done': 'User blocked. You will no longer see messages from this person.',
      'messages.report_user': 'Report user',
      'messages.pii_warning':
        '⚠️ It looks like you are sharing personal info (phone number or banking details). Never share this in messages — it can be used for fraud. Send anyway?',
      'messages.scam_help_title': 'Safety tip',
      'messages.scam_help_body':
        'Never share phone numbers, bank account numbers, BankID codes or personal IDs in messages. If someone asks for money or help moving money — report and block them right away.',
      'profile.title': 'My profile',
      'profile.bio_label': 'Tell others about you',
      'profile.bio_help': 'Other members can see this.',
      'profile.save': 'Save changes',
      'profile.replay_tutorial': 'Show the introduction again',
      'profile.communities_title': 'My communities',
      'profile.created_title': 'Groups you created',
      'profile.created_help': 'The groups you started always live here — even if you have left them.',
      'profile.created_member': 'Member',
      'profile.created_left': 'Left',
      'profile.privacy_title': 'Your rights',
      'profile.export_data': 'Download my data',
      'profile.export_help':
        'You have the right to a copy of all data we store about you (GDPR Article 20).',
      'profile.export_started': 'The file will download shortly.',
      'profile.blocked_title': 'Blocked users',
      'profile.blocked_empty': 'You have not blocked anyone.',
      'profile.unblock': 'Unblock',
      'common.report': 'Report',
      'report.title': 'Report content',
      'report.help':
        'Briefly describe what is wrong. We take every report seriously.',
      'report.reason_placeholder': 'E.g. "This user asked me for money"',
      'report.submit': 'Submit report',
      'report.cancel': 'Cancel',
      'report.submitted': 'Thank you, we have received your report.',
      'report.post_button': 'Report post',
      'profile.member_since': 'Member since {{date}}',
      'tutorial.title': 'Welcome to Gemenskap',
      'tutorial.step1.title': 'You are here – Home',
      'tutorial.step1.body':
        'Here you see your next event and the latest posts from your group.',
      'tutorial.step2.title': 'Community',
      'tutorial.step2.body':
        'Write posts, see members and plan activities with your group.',
      'tutorial.step3.title': 'Events',
      'tutorial.step3.body':
        'All upcoming activities you can join, gathered in one place.',
      'tutorial.step4.title': 'Messages',
      'tutorial.step4.body':
        'Send direct messages to other members – private and safe.',
      'tutorial.next': 'Next',
      'tutorial.done': 'Got it',
      'tutorial.skip': 'Skip the introduction',
      'interests.cat_outdoor': 'Nature & outdoors',
      'interests.cat_sport': 'Sport & games',
      'interests.cat_create': 'Create & express',
      'interests.cat_culture': 'Books & culture',
      'interests.cat_food': 'Food & company',
      'interests.cat_health': 'Health & movement',
      'errors.network':
        'We cannot reach the internet right now. Check your connection and try again.',
      'errors.generic':
        'Something did not go right. Wait a moment and try again – it usually sorts itself out.',
      'browse.title': 'Explore communities',
      'browse.subtitle': 'All available groups. Join one that fits you.',
      'browse.join': 'Join',
      'browse.already_member': 'Already a member',
      'browse.full': 'Full',
      'browse.go_to': 'Go to community',
      'browse.button': 'Explore all communities',
      'browse.filter_search_label': 'Search by name',
      'browse.filter_search_placeholder': 'E.g. "walking" or "chess"',
      'browse.filter_city_label': 'City',
      'browse.filter_city_any': 'All cities',
      'browse.filter_interest_label': 'Interest',
      'browse.filter_interest_any': 'All interests',
      'browse.filter_near_me': 'Only near me (≤ 80 km)',
      'browse.filter_available': 'Only with open spots',
      'browse.filter_clear': 'Clear filters',
      'browse.filter_count': 'Showing {{n}} of {{total}} groups',
      'browse.filter_no_match': 'No groups matched the filters. Try clearing one.',
      'profile.upload_photo': 'Add photo',
      'profile.change_photo': 'Change photo',
      'profile.remove_photo': 'Remove photo',
      'profile.remove_photo_confirm':
        'Remove your profile photo? Others will see your initials instead.',
      'profile.photo_removed': 'Photo removed.',
      'profile.photo_help': 'Pick a photo from your computer or phone.',
      'profile.photo_saved': 'Photo saved!',
      'profile.delete_account': 'Delete my account',
      'profile.delete_confirm': 'Are you completely sure? All your information will be permanently deleted and cannot be recovered.',
      'profile.delete_confirm_button': 'Yes, delete my account',
      'profile.deleted': 'Your account has been deleted. We hope you enjoyed your time here.',
      'profile.settings_title': 'Settings',
      'time.now': 'just now',
      'time.min_ago': '{{n}} min ago',
      'time.hour_ago': '{{n}} hr ago',
      'time.yesterday': 'yesterday',
      'time.days_ago': '{{n}} days ago',
    },
  };

  function getLang() {
    return localStorage.getItem('lang') || 'sv';
  }
  function setLang(lang) {
    if (lang !== 'sv' && lang !== 'en') return;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    applyTranslations();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }
  function t(key, params) {
    const lang = getLang();
    let str = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.sv[key] || key;
    if (params) {
      for (const k of Object.keys(params)) {
        str = str.replace(new RegExp('{{' + k + '}}', 'g'), params[k]);
      }
    }
    return str;
  }
  function applyTranslations(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
  }
  function relativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60 * 1000) return t('time.now');
    if (diff < 60 * 60 * 1000) return t('time.min_ago', { n: Math.floor(diff / 60000) });
    if (diff < 24 * 60 * 60 * 1000) return t('time.hour_ago', { n: Math.floor(diff / 3600000) });
    if (diff < 48 * 60 * 60 * 1000) return t('time.yesterday');
    return t('time.days_ago', { n: Math.floor(diff / (24 * 3600000)) });
  }
  function formatEventTime(ts) {
    const lang = getLang();
    return new Date(ts).toLocaleString(lang === 'sv' ? 'sv-SE' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = getLang();
    applyTranslations();
  });

  window.I18n = { t, getLang, setLang, applyTranslations, relativeTime, formatEventTime };
})();
