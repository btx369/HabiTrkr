/**
 * Text for Help/About, Terms of Service and Privacy Policy.
 *
 * PLACEHOLDER COPY. These pages exist so the routes and layout work; the wording is a
 * draft to be replaced (and reviewed, for the legal pages) before release. Kept out of
 * LanguageContext because it is long-form and will be rewritten wholesale. Languages
 * without their own text fall back to English.
 */

export interface InfoSection {
  heading: string;
  body: string[];
}

type PageText = Record<'en' | 'pt', InfoSection[]>;

/** Shown at the end of the Terms and Privacy pages. Change it whenever their text changes. */
export const LEGAL_UPDATED = '2026-11-04';

export const ABOUT: PageText = {
  en: [
    { heading: 'What HabiTrkr is', body: ['HabiTrkr keeps your habits, notes, events and calendar in one place. Everything is stored on your device; there is no account and no server.'] },
    { heading: 'Getting started', body: ['Create a habit with the + button and tap a day to mark it done.', 'Notes can be text or checklists, with photos and recordings. Lock a note with a PIN, or with your note password to encrypt it.', 'Events can repeat, and show up in the calendar on every day they happen.'] },
    { heading: 'Your data', body: ['Use Profile → Data storage → Export to keep a copy of everything, and Import to restore it on another device.'] },
  ],
  pt: [
    { heading: 'O que é o HabiTrkr', body: ['O HabiTrkr junta os seus hábitos, notas, eventos e calendário num só lugar. Tudo fica guardado no seu dispositivo: não há conta nem servidor.'] },
    { heading: 'Primeiros passos', body: ['Crie um hábito com o botão + e toque num dia para o marcar como feito.', 'As notas podem ser texto ou listas, com fotos e gravações. Bloqueie uma nota com um PIN, ou com a palavra-passe das notas para a cifrar.', 'Os eventos podem repetir-se e aparecem no calendário em todos os dias em que acontecem.'] },
    { heading: 'Os seus dados', body: ['Use Perfil → Armazenamento de dados → Exportar para guardar uma cópia de tudo, e Importar para a recuperar noutro dispositivo.'] },
  ],
};

export const TERMS: PageText = {
  en: [
    { heading: 'Draft', body: ['These terms are a placeholder and are not yet in force.'] },
    { heading: '1. Using the app', body: ['HabiTrkr is provided as is, free of charge, for personal use. You are responsible for the content you create in it.'] },
    { heading: '2. Your content', body: ['Your habits, notes and events are yours. They stay on your device and are not sent to us.'] },
    { heading: '3. Changes', body: ['We may update these terms; the date below will change when we do.'] },
  ],
  pt: [
    { heading: 'Rascunho', body: ['Estes termos são provisórios e ainda não estão em vigor.'] },
    { heading: '1. Utilização da app', body: ['O HabiTrkr é disponibilizado tal como está, gratuitamente, para uso pessoal. É responsável pelo conteúdo que nele criar.'] },
    { heading: '2. O seu conteúdo', body: ['Os seus hábitos, notas e eventos são seus. Ficam no seu dispositivo e não nos são enviados.'] },
    { heading: '3. Alterações', body: ['Podemos atualizar estes termos; a data abaixo muda quando o fizermos.'] },
  ],
};

export const PRIVACY: PageText = {
  en: [
    { heading: 'Draft', body: ['This policy is a placeholder and is not yet in force.'] },
    { heading: 'What we collect', body: ['Nothing. HabiTrkr has no account, no analytics and no server. Your data is stored only in this browser or on this phone.'] },
    { heading: 'Feedback', body: ['If you send feedback, it goes from your own email app, and we only see what you choose to send.'] },
    { heading: 'Backups', body: ['Exported backups are files you keep. Notes protected with the note password stay encrypted inside them.'] },
  ],
  pt: [
    { heading: 'Rascunho', body: ['Esta política é provisória e ainda não está em vigor.'] },
    { heading: 'O que recolhemos', body: ['Nada. O HabiTrkr não tem conta, estatísticas de utilização nem servidor. Os seus dados ficam guardados apenas neste browser ou neste telemóvel.'] },
    { heading: 'Feedback', body: ['Se enviar feedback, ele sai da sua própria app de email, e só vemos o que decidir enviar.'] },
    { heading: 'Backups', body: ['Os backups exportados são ficheiros que guarda consigo. As notas protegidas com a palavra-passe continuam cifradas dentro deles.'] },
  ],
};

export const textFor = (page: PageText, language: string): InfoSection[] =>
  language === 'pt' ? page.pt : page.en;
