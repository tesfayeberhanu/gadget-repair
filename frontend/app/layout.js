import './globals.css';
import './intake.css';
import './auth.css';

export const metadata = {
  title: 'iFixLab251 | Repair Operations',
  description: 'Role-aware repair shop operations, inventory, billing, and reporting',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
