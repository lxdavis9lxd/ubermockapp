import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { CheckCircle, Info, AlertCircle } from "@/components/ui/icons";

const sampleRows = [
  { id: 1, name: "Ada Lovelace", role: "Student", status: "Active" },
  { id: 2, name: "Grace Hopper", role: "Mentor", status: "Active" },
  { id: 3, name: "Alan Turing", role: "Admin", status: "Inactive" },
];

export default function ComponentTest() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [progress, setProgress] = useState(40);
  const [switchOn, setSwitchOn] = useState(false);
  const [checked, setChecked] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">shadcn/ui Component Test</h1>
        <Badge>All Components</Badge>
      </div>

      <Separator />

      {/* Alerts */}
      <Card>
        <CardHeader><CardTitle>Alert</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>This is a default informational alert.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong. Please try again.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Avatar */}
      <Card>
        <CardHeader><CardTitle>Avatar</CardTitle></CardHeader>
        <CardContent className="flex gap-4">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>GH</AvatarFallback>
          </Avatar>
        </CardContent>
      </Card>

      {/* Badge */}
      <Card>
        <CardHeader><CardTitle>Badge</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </CardContent>
      </Card>

      {/* Button */}
      <Card>
        <CardHeader><CardTitle>Button</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => toast.success("Primary clicked!")}>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </CardContent>
      </Card>

      {/* Checkbox + Switch */}
      <Card>
        <CardHeader><CardTitle>Checkbox &amp; Switch</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox id="test-cb" checked={checked} onCheckedChange={setChecked} />
            <Label htmlFor="test-cb">Accept terms: {checked ? "Yes" : "No"}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="test-sw" checked={switchOn} onCheckedChange={setSwitchOn} />
            <Label htmlFor="test-sw">Notifications: {switchOn ? "On" : "Off"}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Input + Textarea + Select + Label */}
      <Card>
        <CardHeader><CardTitle>Input / Textarea / Select</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ct-name">Name</Label>
            <Input id="ct-name" placeholder="Enter your name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ct-bio">Bio</Label>
            <Textarea id="ct-bio" placeholder="Tell us about yourself" />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="mentor">Mentor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setProgress(Math.max(0, progress - 10))}>-10</Button>
            <Button size="sm" onClick={() => setProgress(Math.min(100, progress + 10))}>+10</Button>
            <span className="text-sm self-center">{progress}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Skeleton */}
      <Card>
        <CardHeader><CardTitle>Skeleton</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader><CardTitle>Tabs</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Tab One</TabsTrigger>
              <TabsTrigger value="tab2">Tab Two</TabsTrigger>
              <TabsTrigger value="tab3">Tab Three</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1"><p className="mt-2 text-sm">Content for Tab One.</p></TabsContent>
            <TabsContent value="tab2"><p className="mt-2 text-sm">Content for Tab Two.</p></TabsContent>
            <TabsContent value="tab3"><p className="mt-2 text-sm">Content for Tab Three.</p></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Table</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "Active" ? "default" : "secondary"}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Card>
        <CardHeader><CardTitle>Dialog</CardTitle></CardHeader>
        <CardContent>
          <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>shadcn Dialog</DialogTitle>
                <DialogDescription>This is a modal dialog from shadcn/ui.</DialogDescription>
              </DialogHeader>
              <p className="text-sm">Dialog content goes here.</p>
              <Button className="mt-4" onClick={() => setDialogOpen(false)}>Close</Button>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Sheet */}
      <Card>
        <CardHeader><CardTitle>Sheet</CardTitle></CardHeader>
        <CardContent>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Side Sheet</SheetTitle>
              </SheetHeader>
              <p className="mt-4 text-sm">Sheet content from shadcn/ui.</p>
            </SheetContent>
          </Sheet>
        </CardContent>
      </Card>

      {/* Tooltip */}
      <Card>
        <CardHeader><CardTitle>Tooltip</CardTitle></CardHeader>
        <CardContent>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a shadcn Tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Toast */}
      <Card>
        <CardHeader><CardTitle>Toast (Sonner)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => toast.success("Success toast!")}>Success</Button>
          <Button variant="destructive" onClick={() => toast.error("Error toast!")}>Error</Button>
          <Button variant="outline" onClick={() => toast.info("Info toast!")}>Info</Button>
          <Button variant="secondary" onClick={() => toast.warning("Warning toast!")}>Warning</Button>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-4">
        <a href="/" className="text-sm text-blue-600 hover:underline">&larr; Back to Home</a>
      </div>
    </div>
  );
}
