import { useStyle } from '../components/ui/StyleProvider';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Tabs } from '../components/ui/Tabs';

function StylePresetSwitcher() {
  const { preset, setPreset } = useStyle();
  return (
    <div className="mb-12 p-6 border rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <h3 className="text-xl font-bold mb-4">Style Presets</h3>
      <div className="flex gap-4">
        {['default', 'soft', 'outlined', 'crisp'].map((p) => (
          <Button 
            key={p} 
            variant={preset === p ? 'primary' : 'outline'} 
            onClick={() => setPreset(p as any)}
          >
            {p}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function StyleGuide() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-16">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-[var(--color-navy-900)]">Design System & Style Guide</h1>
        <p className="text-[var(--color-navy-500)]">A showcase of reusable components and tokens for PrepAmigo.</p>
      </div>
      
      <StylePresetSwitcher />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Colors</h2>
        <div className="flex gap-4 flex-wrap">
          <div className="w-24 h-24 bg-[var(--color-navy-900)] rounded-[var(--radius-control)]"></div>
          <div className="w-24 h-24 bg-[var(--color-forest-700)] rounded-[var(--radius-control)]"></div>
          <div className="w-24 h-24 bg-[var(--color-amber-600)] rounded-[var(--radius-control)]"></div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Buttons</h2>
        <div className="flex gap-4">
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Cards</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card variant="default" className="p-4">Default Card</Card>
          <Card variant="muted" className="p-4">Muted Card</Card>
          <Card variant="outlined" className="p-4">Outlined Card</Card>
          <Card variant="elevated" className="p-4">Elevated Card</Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Badges</h2>
        <div className="flex gap-4">
          <Badge variant="navy" styleType="solid">Navy</Badge>
          <Badge variant="forest" styleType="soft">Forest</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Alerts</h2>
        <div className="space-y-2">
          <Alert variant="info">Info Alert</Alert>
          <Alert variant="success">Success Alert</Alert>
        </div>
      </section>
      
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Tabs</h2>
        <Tabs tabs={[{ id: '1', label: 'Tab 1' }, { id: '2', label: 'Tab 2' }]} variant="segmented" />
      </section>
    </div>
  );
}
