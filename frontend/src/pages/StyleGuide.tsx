import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { SearchInput } from '../components/ui/SearchInput';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Toast } from '../components/ui/Toast';
import { Tooltip } from '../components/ui/Tooltip';
import { Logo } from '../components/ui/Logo';

export function StyleGuide() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-16">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Design System & Style Guide</h1>
        <p className="text-secondary-text">A showcase of reusable components and tokens for TravelAmigo.</p>
      </div>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Branding</h2>
        <div className="flex flex-col gap-6 p-6 bg-surface-elevated rounded-xl border border-border">
          <div>
            <h3 className="text-sm text-secondary-text mb-4">Logo Full</h3>
            <Logo />
          </div>
          <div>
            <h3 className="text-sm text-secondary-text mb-4">Logo Compact</h3>
            <Logo compact />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Background', class: 'bg-background' },
            { name: 'Surface', class: 'bg-surface' },
            { name: 'Elevated', class: 'bg-surface-elevated' },
            { name: 'Border', class: 'bg-border' },
            { name: 'Primary', class: 'bg-primary' },
            { name: 'Accent', class: 'bg-accent' },
            { name: 'Success', class: 'bg-success' },
            { name: 'Warning', class: 'bg-warning' },
            { name: 'Error', class: 'bg-error' },
            { name: 'Info', class: 'bg-info' },
          ].map((color) => (
            <div key={color.name} className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-lg border border-border ${color.class}`} />
              <span className="text-sm font-medium">{color.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Typography</h2>
        <div className="space-y-4">
          <div className="text-4xl font-bold">Display (4xl)</div>
          <div className="text-3xl font-semibold">Heading 1 (3xl)</div>
          <div className="text-2xl font-semibold">Heading 2 (2xl)</div>
          <div className="text-xl font-semibold">Heading 3 (xl)</div>
          <div className="text-base text-primary-text">Body (base) - Tell kaju what changed. TravelAmigo figures out what happens next.</div>
          <div className="text-sm text-secondary-text">Body Small (sm) - Secondary text style.</div>
          <div className="text-xs text-muted-text uppercase tracking-wider font-semibold">Label (xs)</div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Buttons</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button isLoading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <IconButton icon="airplane-outline" variant="primary" />
          <IconButton icon="add-outline" variant="secondary" />
          <IconButton icon="ellipsis-vertical-outline" variant="ghost" />
          <IconButton icon="trash-outline" variant="danger" />
          <IconButton icon="save-outline" isLoading />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Form Elements</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Input placeholder="Standard Input" />
            <Input placeholder="Error Input" error />
            <Input placeholder="Disabled Input" disabled />
          </div>
          <div className="space-y-4">
            <SearchInput placeholder="Search trips..." />
            <Select>
              <option>Option 1</option>
              <option>Option 2</option>
            </Select>
            <Select error>
              <option>Error Select</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Textarea placeholder="Text area..." />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Badges & Status</h2>
        <div className="flex flex-wrap gap-4">
          <Badge>Default Badge</Badge>
          <Badge variant="primary">Primary Badge</Badge>
          <Badge variant="secondary">Secondary Badge</Badge>
          <Badge variant="outline">Outline Badge</Badge>
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <StatusBadge status="success">Confirmed</StatusBadge>
          <StatusBadge status="warning">Pending</StatusBadge>
          <StatusBadge status="error">Cancelled</StatusBadge>
          <StatusBadge status="info">Updated</StatusBadge>
          <StatusBadge status="default">Draft</StatusBadge>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Cards & Layout</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Standard Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-secondary-text text-sm">Cards provide flexible layout containers.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="secondary">Action</Button>
            </CardFooter>
          </Card>

          <Card elevated>
            <CardHeader>
              <CardTitle>Elevated Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-secondary-text text-sm">Uses elevated background and stronger shadow.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Primary Action</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Feedback & States</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <EmptyState 
            title="No trips found" 
            description="You haven't created any trips yet. Tell kaju to plan one for you!" 
            action={<Button size="sm" variant="secondary">Create Trip</Button>}
          />
          <ErrorState />
        </div>
        <div className="flex gap-4">
          <div className="w-64 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="flex gap-4 items-center">
            <Avatar size="sm" />
            <Avatar size="md" />
            <Avatar size="lg" />
            <Avatar size="xl" src="https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff" />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b border-border pb-2">Overlays (Toasts & Tooltips)</h2>
        <div className="space-y-4">
          <div className="flex gap-6">
            <Tooltip content="This is a top tooltip">
              <span className="cursor-help underline underline-offset-4 decoration-dashed text-secondary-text">Hover me (Top)</span>
            </Tooltip>
            <Tooltip content="This is a right tooltip" position="right">
              <span className="cursor-help underline underline-offset-4 decoration-dashed text-secondary-text">Hover me (Right)</span>
            </Tooltip>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Toast title="Trip created successfully" variant="success" onClose={() => {}} />
            <Toast title="Flight changed" description="Your departure time has moved." variant="warning" onClose={() => {}} />
          </div>
        </div>
      </section>
      
      {/* Blurred blobs testing on the style guide page */}
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-gradient-blob-1 -z-10 pointer-events-none rounded-full" />
    </div>
  );
}
