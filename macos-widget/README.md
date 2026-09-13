# ווידג׳ט macOS לשלט

ווידג׳ט WidgetKit אמיתי — כזה שיושב על שולחן העבודה ובמרכז ההתראות לצד ווידג׳טים
של מזג אוויר ולוח שנה — עם כפתורים לחיצים שמפעילים את הטלוויזיה.

הווידג׳ט **לא** מדבר SSAP מול הטלוויזיה. הוא לקוח של אותו שרת HTTP מקומי
שאפליקציית RemoteC כבר מריצה, כך שההתאמה (pairing), המפתח השמור והפרוטוקול
נשארים במקום אחד. המשמעות המעשית: **RemoteC חייבת לרוץ** (או `npm run server`),
אחרת הכפתורים לא יעשו דבר והנורית תהיה אדומה.

## דרישות
- macOS 14 ומעלה — כפתורים לחיצים בווידג׳ט עובדים דרך App Intents, שנוספו שם.
- **Xcode** (חינם מה-App Store). Command Line Tools לבד לא מספיקים: הכלי
  `appintentsmetadataprocessor`, שבלעדיו כפתורי הווידג׳ט לא נרשמים, מגיע רק עם Xcode.
- Apple ID לחתימה (חשבון מפתח חינמי מספיק).

## בנייה
```bash
open macos-widget/RemoteCWidget.xcodeproj
```
1. בחר את הטארגט **RemoteCWidget** → *Signing & Capabilities* → *Team*: ה-Apple ID שלך.
   חזור על כך גם עבור הטארגט **RemoteWidgetExtension**.
   אם Xcode מתלונן שה-bundle identifier תפוס, שנה את `com.remotec.widget`
   ל-`com.<השם-שלך>.remotec.widget` (ואת זה של ה-extension בהתאם).
   לחלופין, ל-macOS אפשר לבחור *Signing Certificate → Sign to Run Locally*.
2. ▶︎ Run. האפליקציה חייבת לרוץ לפחות פעם אחת כדי ש-macOS ירשום את הווידג׳ט.
3. כדי שהווידג׳ט יישאר זמין גם אחרי סגירת Xcode, העתק את `RemoteCWidget.app`
   מתיקיית ה-Products אל `/Applications`.

## הוספת הווידג׳ט
לחיצה ימנית על שולחן העבודה → *עריכת ווידג׳טים* (או פתיחת מרכז ההתראות) →
חיפוש "RemoteC" → בחירת גודל.

| גודל | מקשים |
| --- | --- |
| קטן | VOL+/−, חצים, OK, הפעלה, השתקה |
| בינוני | צלב ניווט מלא + VOL, CH, הפעלה, השתקה, Play-Pause, חזרה, בית |
| גדול | כל האמור לעיל + EXIT, INFO ושורת מדיה (הרצה אחורה/נגן/השהה/עצור/קדימה) |

## מבנה
| קובץ | תפקיד |
| --- | --- |
| `Shared/RemoteServer.swift` | כתובת השרת, פענוח `/api/status` ו-`/api/audio`, שליחת פקודות |
| `Shared/Theme.swift` | הפלטה של השלט, כדי שהווידג׳ט ייראה כמו אותו מוצר |
| `Widget/RemoteIntents.swift` | App Intents: מקש רגיל, השתקה, והפעלה שבוחרת בין כיבוי ל-Wake-on-LAN |
| `Widget/RemoteWidgetView.swift` | הפריסות לשלושת הגדלים |
| `Widget/RemoteWidget.swift` | ה-timeline: נורית מצב ומצב השתקה בלבד |
| `App/` | אפליקציית מעטפת דקה — macOS מציע ווידג׳טים רק מתוך אפליקציה |

## פורט אחר
אם שינית את `"port"` ב-config.json, עדכן בהתאם את `RemoteServer.port`
ב-`Shared/RemoteServer.swift` ובנה מחדש.
