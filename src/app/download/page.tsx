import { redirect } from 'next/navigation'

// /download is a stable, marketable URL for the desktop terminal page.
// The canonical content lives at /flight-deck — this redirect keeps both
// alive without duplicating the page.
export default function DownloadPage(): never {
  redirect('/flight-deck')
}
