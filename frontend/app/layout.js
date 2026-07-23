import './globals.css';

export const metadata = {
  title: 'Gadget Repair',
  description: 'Fast gadget repair and device servicing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
