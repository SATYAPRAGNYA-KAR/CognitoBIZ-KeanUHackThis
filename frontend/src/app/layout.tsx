// import './globals.css'
// import { Sidebar } from '@/components/layout/Sidebar'

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode
// }) {
//   return (
//     <html lang="en">
//       <body>
//         <div className="min-h-screen bg-obsidian-950 bg-grid flex">
//           <Sidebar />
//           <main className="flex-1 pl-60 min-h-screen">
//             {children}
//           </main>
//         </div>
//       </body>
//     </html>
//   )
// }

import './globals.css'
import ClientLayout from './ClientLayout'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}