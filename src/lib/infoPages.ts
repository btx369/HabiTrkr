/**
 * Text for Help/About, Terms of Service and Privacy Policy.
 *
 * PLACEHOLDER COPY. These pages exist so the routes and layout work; the wording is a
 * draft to be replaced (and reviewed, for the legal pages) before release. Kept out of
 * LanguageContext because it is long-form and will be rewritten wholesale. Every app
 * language has its own text; English is only the fallback for an unknown language.
 */

import type { Language } from '@/contexts/LanguageContext';

export interface InfoSection {
  heading: string;
  body: string[];
}

type PageText = Record<Language, InfoSection[]>;

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
  es: [
    { heading: "Qué es HabiTrkr", body: ["HabiTrkr reúne tus hábitos, notas, eventos y calendario en un solo lugar. Todo se guarda en tu dispositivo: no hay cuenta ni servidor."] },
    { heading: "Primeros pasos", body: ["Crea un hábito con el botón + y toca un día para marcarlo como hecho.", "Las notas pueden ser texto o listas, con fotos y grabaciones. Bloquea una nota con un PIN, o con la contraseña de notas para cifrarla.", "Los eventos pueden repetirse y aparecen en el calendario todos los días en que ocurren."] },
    { heading: "Tus datos", body: ["Usa Perfil → Almacenamiento de Datos → Exportar para guardar una copia de todo, e Importar para recuperarla en otro dispositivo."] },
  ],
  fr: [
    { heading: "Qu'est-ce que HabiTrkr", body: ["HabiTrkr réunit vos habitudes, notes, événements et calendrier au même endroit. Tout est stocké sur votre appareil : pas de compte, pas de serveur."] },
    { heading: "Premiers pas", body: ["Créez une habitude avec le bouton + et touchez un jour pour la marquer comme faite.", "Les notes peuvent être du texte ou des listes, avec photos et enregistrements. Verrouillez une note avec un code PIN, ou avec le mot de passe des notes pour la chiffrer.", "Les événements peuvent se répéter et apparaissent dans le calendrier chaque jour où ils ont lieu."] },
    { heading: "Vos données", body: ["Utilisez Profil → Stockage des Données → Exporter pour garder une copie de tout, et Importer pour la restaurer sur un autre appareil."] },
  ],
  de: [
    { heading: "Was HabiTrkr ist", body: ["HabiTrkr bündelt deine Gewohnheiten, Notizen, Ereignisse und deinen Kalender an einem Ort. Alles wird auf deinem Gerät gespeichert: kein Konto, kein Server."] },
    { heading: "Erste Schritte", body: ["Lege mit der +-Taste eine Gewohnheit an und tippe auf einen Tag, um sie als erledigt zu markieren.", "Notizen können Text oder Listen sein, mit Fotos und Aufnahmen. Sperre eine Notiz mit einer PIN oder mit deinem Notizpasswort, um sie zu verschlüsseln.", "Ereignisse können sich wiederholen und erscheinen im Kalender an jedem Tag, an dem sie stattfinden."] },
    { heading: "Deine Daten", body: ["Nutze Profil → Datenspeicherung → Exportieren, um eine Kopie von allem zu behalten, und Importieren, um sie auf einem anderen Gerät wiederherzustellen."] },
  ],
  it: [
    { heading: "Cos'è HabiTrkr", body: ["HabiTrkr riunisce abitudini, note, eventi e calendario in un unico posto. Tutto è salvato sul tuo dispositivo: nessun account e nessun server."] },
    { heading: "Per iniziare", body: ["Crea un'abitudine con il pulsante + e tocca un giorno per segnarla come fatta.", "Le note possono essere testo o liste, con foto e registrazioni. Blocca una nota con un PIN, o con la password delle note per cifrarla.", "Gli eventi possono ripetersi e compaiono nel calendario in ogni giorno in cui si svolgono."] },
    { heading: "I tuoi dati", body: ["Usa Profilo → Archiviazione Dati → Esporta per tenere una copia di tutto, e Importa per ripristinarla su un altro dispositivo."] },
  ],
  nl: [
    { heading: "Wat HabiTrkr is", body: ["HabiTrkr brengt je gewoontes, notities, gebeurtenissen en agenda samen op één plek. Alles wordt op je apparaat bewaard: geen account en geen server."] },
    { heading: "Aan de slag", body: ["Maak een gewoonte met de knop + en tik op een dag om die als gedaan te markeren.", "Notities kunnen tekst of lijsten zijn, met foto's en opnames. Vergrendel een notitie met een pincode, of met je notitiewachtwoord om haar te versleutelen.", "Gebeurtenissen kunnen zich herhalen en verschijnen in de agenda op elke dag dat ze plaatsvinden."] },
    { heading: "Je gegevens", body: ["Gebruik Profiel → Gegevensopslag → Exporteren om een kopie van alles te bewaren, en Importeren om die op een ander apparaat terug te zetten."] },
  ],
  pl: [
    { heading: "Czym jest HabiTrkr", body: ["HabiTrkr łączy nawyki, notatki, wydarzenia i kalendarz w jednym miejscu. Wszystko jest zapisane na Twoim urządzeniu: bez konta i bez serwera."] },
    { heading: "Pierwsze kroki", body: ["Utwórz nawyk przyciskiem + i dotknij dnia, aby oznaczyć go jako wykonany.", "Notatki mogą być tekstem lub listami, ze zdjęciami i nagraniami. Zablokuj notatkę kodem PIN albo hasłem notatek, aby ją zaszyfrować.", "Wydarzenia mogą się powtarzać i pojawiają się w kalendarzu w każdym dniu, w którym się odbywają."] },
    { heading: "Twoje dane", body: ["Użyj Profil → Przechowywanie danych → Eksportuj, aby zachować kopię wszystkiego, oraz Importuj, aby przywrócić ją na innym urządzeniu."] },
  ],
  tr: [
    { heading: "HabiTrkr nedir", body: ["HabiTrkr alışkanlıklarınızı, notlarınızı, etkinliklerinizi ve takviminizi tek bir yerde toplar. Her şey cihazınızda saklanır: hesap yok, sunucu yok."] },
    { heading: "Başlarken", body: ["+ düğmesiyle bir alışkanlık oluşturun ve tamamlandı olarak işaretlemek için bir güne dokunun.", "Notlar metin veya liste olabilir; fotoğraf ve kayıt içerebilir. Bir notu PIN ile kilitleyin ya da şifrelemek için not parolanızı kullanın.", "Etkinlikler tekrarlanabilir ve gerçekleştikleri her gün takvimde görünür."] },
    { heading: "Verileriniz", body: ["Her şeyin bir kopyasını saklamak için Profil → Veri Depolama → Dışa Aktar'ı, başka bir cihazda geri yüklemek için İçe Aktar'ı kullanın."] },
  ],
  ja: [
    { heading: "HabiTrkrとは", body: ["HabiTrkrは習慣、メモ、イベント、カレンダーを1か所にまとめます。すべて端末に保存され、アカウントもサーバーもありません。"] },
    { heading: "はじめに", body: ["+ボタンで習慣を作成し、日付をタップして完了にします。", "メモはテキストまたはリストにでき、写真や録音も追加できます。PINでメモをロックするか、メモのパスワードで暗号化できます。", "イベントは繰り返し設定でき、開催されるすべての日にカレンダーに表示されます。"] },
    { heading: "データについて", body: ["プロフィール → データストレージ → エクスポートですべてのコピーを保存し、インポートで別の端末に復元できます。"] },
  ],
  zh: [
    { heading: "HabiTrkr 是什么", body: ["HabiTrkr 把你的习惯、笔记、事件和日历集中在一个地方。所有内容都保存在你的设备上:没有账户,也没有服务器。"] },
    { heading: "快速上手", body: ["用 + 按钮创建习惯,点按某一天将其标记为完成。", "笔记可以是文本或列表,并可添加照片和录音。用 PIN 锁定笔记,或用笔记密码将其加密。", "事件可以重复,并会在发生的每一天显示在日历中。"] },
    { heading: "你的数据", body: ["使用 个人资料 → 数据存储 → 导出 来保存所有内容的副本,使用 导入 在其他设备上恢复。"] },
  ],
  ko: [
    { heading: "HabiTrkr란", body: ["HabiTrkr는 습관, 메모, 이벤트, 캘린더를 한곳에 모아 줍니다. 모든 데이터는 기기에 저장되며 계정도 서버도 없습니다."] },
    { heading: "시작하기", body: ["+ 버튼으로 습관을 만들고 날짜를 탭하여 완료로 표시하세요.", "메모는 텍스트나 목록으로 만들 수 있으며 사진과 녹음을 넣을 수 있습니다. PIN으로 메모를 잠그거나 메모 비밀번호로 암호화하세요.", "이벤트는 반복할 수 있으며 열리는 모든 날짜에 캘린더에 표시됩니다."] },
    { heading: "내 데이터", body: ["프로필 → 데이터 저장소 → 내보내기로 모든 데이터의 사본을 보관하고, 가져오기로 다른 기기에서 복원하세요."] },
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
  es: [
    { heading: "Borrador", body: ["Estos términos son provisionales y aún no están en vigor."] },
    { heading: "1. Uso de la app", body: ["HabiTrkr se ofrece tal cual, de forma gratuita y para uso personal. Eres responsable del contenido que crees en ella."] },
    { heading: "2. Tu contenido", body: ["Tus hábitos, notas y eventos son tuyos. Se quedan en tu dispositivo y no se nos envían."] },
    { heading: "3. Cambios", body: ["Podemos actualizar estos términos; la fecha de abajo cambiará cuando lo hagamos."] },
  ],
  fr: [
    { heading: "Brouillon", body: ["Ces conditions sont provisoires et ne sont pas encore en vigueur."] },
    { heading: "1. Utilisation de l'app", body: ["HabiTrkr est fourni tel quel, gratuitement, pour un usage personnel. Vous êtes responsable du contenu que vous y créez."] },
    { heading: "2. Votre contenu", body: ["Vos habitudes, notes et événements vous appartiennent. Ils restent sur votre appareil et ne nous sont pas envoyés."] },
    { heading: "3. Modifications", body: ["Nous pouvons mettre à jour ces conditions ; la date ci-dessous changera alors."] },
  ],
  de: [
    { heading: "Entwurf", body: ["Diese Bedingungen sind vorläufig und noch nicht in Kraft."] },
    { heading: "1. Nutzung der App", body: ["HabiTrkr wird wie besehen, kostenlos und für den persönlichen Gebrauch bereitgestellt. Du bist für die Inhalte verantwortlich, die du darin erstellst."] },
    { heading: "2. Deine Inhalte", body: ["Deine Gewohnheiten, Notizen und Ereignisse gehören dir. Sie bleiben auf deinem Gerät und werden nicht an uns gesendet."] },
    { heading: "3. Änderungen", body: ["Wir können diese Bedingungen aktualisieren; das Datum unten ändert sich dann."] },
  ],
  it: [
    { heading: "Bozza", body: ["Questi termini sono provvisori e non ancora in vigore."] },
    { heading: "1. Uso dell'app", body: ["HabiTrkr è fornito così com'è, gratuitamente, per uso personale. Sei responsabile dei contenuti che crei."] },
    { heading: "2. I tuoi contenuti", body: ["Le tue abitudini, note ed eventi sono tuoi. Restano sul tuo dispositivo e non ci vengono inviati."] },
    { heading: "3. Modifiche", body: ["Potremmo aggiornare questi termini; la data qui sotto cambierà quando lo faremo."] },
  ],
  nl: [
    { heading: "Concept", body: ["Deze voorwaarden zijn voorlopig en nog niet van kracht."] },
    { heading: "1. Gebruik van de app", body: ["HabiTrkr wordt geleverd zoals het is, gratis, voor persoonlijk gebruik. Je bent verantwoordelijk voor de inhoud die je erin maakt."] },
    { heading: "2. Je inhoud", body: ["Je gewoontes, notities en gebeurtenissen zijn van jou. Ze blijven op je apparaat en worden niet naar ons gestuurd."] },
    { heading: "3. Wijzigingen", body: ["We kunnen deze voorwaarden bijwerken; de datum hieronder verandert dan."] },
  ],
  pl: [
    { heading: "Wersja robocza", body: ["Te warunki są tymczasowe i jeszcze nie obowiązują."] },
    { heading: "1. Korzystanie z aplikacji", body: ["HabiTrkr jest udostępniany w obecnej postaci, bezpłatnie, do użytku osobistego. Odpowiadasz za treści, które w nim tworzysz."] },
    { heading: "2. Twoje treści", body: ["Twoje nawyki, notatki i wydarzenia należą do Ciebie. Zostają na Twoim urządzeniu i nie są do nas wysyłane."] },
    { heading: "3. Zmiany", body: ["Możemy aktualizować te warunki; data poniżej zmieni się, gdy to zrobimy."] },
  ],
  tr: [
    { heading: "Taslak", body: ["Bu koşullar geçicidir ve henüz yürürlükte değildir."] },
    { heading: "1. Uygulamanın kullanımı", body: ["HabiTrkr olduğu gibi, ücretsiz ve kişisel kullanım için sunulur. İçinde oluşturduğunuz içerikten siz sorumlusunuz."] },
    { heading: "2. İçeriğiniz", body: ["Alışkanlıklarınız, notlarınız ve etkinlikleriniz size aittir. Cihazınızda kalır ve bize gönderilmez."] },
    { heading: "3. Değişiklikler", body: ["Bu koşulları güncelleyebiliriz; güncellediğimizde aşağıdaki tarih değişir."] },
  ],
  ja: [
    { heading: "草案", body: ["この規約は仮のもので、まだ発効していません。"] },
    { heading: "1. アプリの利用", body: ["HabiTrkrは現状のまま、無料で個人利用のために提供されます。作成したコンテンツについてはご自身が責任を負います。"] },
    { heading: "2. あなたのコンテンツ", body: ["習慣、メモ、イベントはあなたのものです。端末に保存され、私たちに送信されることはありません。"] },
    { heading: "3. 変更", body: ["この規約は更新されることがあります。その際は下の日付が変わります。"] },
  ],
  zh: [
    { heading: "草案", body: ["本条款为临时版本,尚未生效。"] },
    { heading: "1. 使用本应用", body: ["HabiTrkr 按现状免费提供,供个人使用。你需对自己在其中创建的内容负责。"] },
    { heading: "2. 你的内容", body: ["你的习惯、笔记和事件归你所有。它们保存在你的设备上,不会发送给我们。"] },
    { heading: "3. 变更", body: ["我们可能会更新本条款;更新时下方日期会随之改变。"] },
  ],
  ko: [
    { heading: "초안", body: ["이 약관은 임시이며 아직 효력이 없습니다."] },
    { heading: "1. 앱 사용", body: ["HabiTrkr는 있는 그대로 무료로 개인 용도로 제공됩니다. 앱에서 만든 콘텐츠에 대한 책임은 사용자에게 있습니다."] },
    { heading: "2. 내 콘텐츠", body: ["습관, 메모, 이벤트는 사용자의 것입니다. 기기에 남아 있으며 저희에게 전송되지 않습니다."] },
    { heading: "3. 변경", body: ["이 약관은 업데이트될 수 있으며, 그때 아래 날짜가 바뀝니다."] },
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
  es: [
    { heading: "Borrador", body: ["Esta política es provisional y aún no está en vigor."] },
    { heading: "Qué recopilamos", body: ["Nada. HabiTrkr no tiene cuenta, ni estadísticas de uso, ni servidor. Tus datos se guardan solo en este navegador o en este teléfono."] },
    { heading: "Comentarios", body: ["Si envías comentarios, salen desde tu propia app de correo, y solo vemos lo que decidas enviar."] },
    { heading: "Copias de seguridad", body: ["Las copias exportadas son archivos que guardas tú. Las notas protegidas con la contraseña siguen cifradas dentro de ellas."] },
  ],
  fr: [
    { heading: "Brouillon", body: ["Cette politique est provisoire et n'est pas encore en vigueur."] },
    { heading: "Ce que nous collectons", body: ["Rien. HabiTrkr n'a ni compte, ni statistiques d'utilisation, ni serveur. Vos données sont stockées uniquement dans ce navigateur ou sur ce téléphone."] },
    { heading: "Commentaires", body: ["Si vous envoyez un commentaire, il part de votre propre app de messagerie, et nous ne voyons que ce que vous choisissez d'envoyer."] },
    { heading: "Sauvegardes", body: ["Les sauvegardes exportées sont des fichiers que vous conservez. Les notes protégées par le mot de passe y restent chiffrées."] },
  ],
  de: [
    { heading: "Entwurf", body: ["Diese Richtlinie ist vorläufig und noch nicht in Kraft."] },
    { heading: "Was wir erfassen", body: ["Nichts. HabiTrkr hat kein Konto, keine Nutzungsstatistiken und keinen Server. Deine Daten werden nur in diesem Browser oder auf diesem Telefon gespeichert."] },
    { heading: "Feedback", body: ["Wenn du Feedback sendest, geht es von deiner eigenen E-Mail-App aus, und wir sehen nur, was du senden möchtest."] },
    { heading: "Sicherungen", body: ["Exportierte Sicherungen sind Dateien, die du selbst aufbewahrst. Mit dem Passwort geschützte Notizen bleiben darin verschlüsselt."] },
  ],
  it: [
    { heading: "Bozza", body: ["Questa informativa è provvisoria e non ancora in vigore."] },
    { heading: "Cosa raccogliamo", body: ["Niente. HabiTrkr non ha account, statistiche d'uso né server. I tuoi dati sono salvati solo in questo browser o su questo telefono."] },
    { heading: "Feedback", body: ["Se invii un feedback, parte dalla tua app di posta, e vediamo solo ciò che scegli di inviare."] },
    { heading: "Backup", body: ["I backup esportati sono file che conservi tu. Le note protette con la password restano cifrate al loro interno."] },
  ],
  nl: [
    { heading: "Concept", body: ["Dit beleid is voorlopig en nog niet van kracht."] },
    { heading: "Wat we verzamelen", body: ["Niets. HabiTrkr heeft geen account, geen gebruiksstatistieken en geen server. Je gegevens staan alleen in deze browser of op deze telefoon."] },
    { heading: "Feedback", body: ["Als je feedback stuurt, gaat die via je eigen e-mailapp, en we zien alleen wat je zelf kiest te sturen."] },
    { heading: "Back-ups", body: ["Geëxporteerde back-ups zijn bestanden die je zelf bewaart. Notities die met het wachtwoord zijn beveiligd, blijven daarin versleuteld."] },
  ],
  pl: [
    { heading: "Wersja robocza", body: ["Ta polityka jest tymczasowa i jeszcze nie obowiązuje."] },
    { heading: "Co zbieramy", body: ["Nic. HabiTrkr nie ma konta, statystyk użycia ani serwera. Twoje dane są zapisane tylko w tej przeglądarce lub na tym telefonie."] },
    { heading: "Opinie", body: ["Jeśli wyślesz opinię, wychodzi ona z Twojej własnej aplikacji pocztowej, a my widzimy tylko to, co zdecydujesz się wysłać."] },
    { heading: "Kopie zapasowe", body: ["Wyeksportowane kopie to pliki, które przechowujesz sam. Notatki chronione hasłem pozostają w nich zaszyfrowane."] },
  ],
  tr: [
    { heading: "Taslak", body: ["Bu politika geçicidir ve henüz yürürlükte değildir."] },
    { heading: "Neler topluyoruz", body: ["Hiçbir şey. HabiTrkr'ın hesabı, kullanım istatistikleri veya sunucusu yoktur. Verileriniz yalnızca bu tarayıcıda veya bu telefonda saklanır."] },
    { heading: "Geri bildirim", body: ["Geri bildirim gönderirseniz kendi e-posta uygulamanızdan gider ve yalnızca göndermeyi seçtiğinizi görürüz."] },
    { heading: "Yedekler", body: ["Dışa aktarılan yedekler sizin sakladığınız dosyalardır. Parolayla korunan notlar bu dosyaların içinde de şifreli kalır."] },
  ],
  ja: [
    { heading: "草案", body: ["このポリシーは仮のもので、まだ発効していません。"] },
    { heading: "収集する情報", body: ["何も収集しません。HabiTrkrにはアカウント、利用統計、サーバーがありません。データはこのブラウザまたはこの電話にのみ保存されます。"] },
    { heading: "フィードバック", body: ["フィードバックはご自身のメールアプリから送信され、私たちが見るのは送信を選んだ内容だけです。"] },
    { heading: "バックアップ", body: ["エクスポートしたバックアップはご自身で保管するファイルです。パスワードで保護されたメモは、その中でも暗号化されたままです。"] },
  ],
  zh: [
    { heading: "草案", body: ["本政策为临时版本,尚未生效。"] },
    { heading: "我们收集什么", body: ["什么都不收集。HabiTrkr 没有账户、没有使用统计,也没有服务器。你的数据只保存在此浏览器或此手机上。"] },
    { heading: "反馈", body: ["如果你发送反馈,它会从你自己的邮件应用发出,我们只能看到你选择发送的内容。"] },
    { heading: "备份", body: ["导出的备份是由你自己保管的文件。受密码保护的笔记在其中仍保持加密。"] },
  ],
  ko: [
    { heading: "초안", body: ["이 정책은 임시이며 아직 효력이 없습니다."] },
    { heading: "수집하는 정보", body: ["없습니다. HabiTrkr에는 계정, 사용 통계, 서버가 없습니다. 데이터는 이 브라우저나 이 휴대폰에만 저장됩니다."] },
    { heading: "피드백", body: ["피드백을 보내면 사용자의 이메일 앱에서 발송되며, 저희는 사용자가 보내기로 한 내용만 봅니다."] },
    { heading: "백업", body: ["내보낸 백업은 사용자가 직접 보관하는 파일입니다. 비밀번호로 보호된 메모는 그 안에서도 암호화된 상태로 유지됩니다."] },
  ],
};

export const textFor = (page: PageText, language: string): InfoSection[] =>
  page[language as Language] ?? page.en;
