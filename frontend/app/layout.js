import './globals.css';
import './intake.css';
import './auth.css';
import './customer.css';
import './delivery.css';
import './inventory.css';
import './repair-progress.css';

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
