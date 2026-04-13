import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Placeholder page - will be fully migrated in Phase 13
export default function GCPage() {
  return (
    <div>
      <PageHeader
        title="Garbage Collection"
        description="Manage OCI blob garbage collection"
        breadcrumb={[
          { label: 'Dashboard', path: '/' },
          { label: 'GC' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Dry Run
            </Button>
            <Button variant="default" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Run GC
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-10 w-[100px]" />
            <Skeleton className="h-10 w-[80px]" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">GC History</TabsTrigger>
          <TabsTrigger value="pending">Pending Deletion</TabsTrigger>
          <TabsTrigger value="unreferenced">Unreferenced Blobs</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-[60px]" />
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-4 w-[80px]" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Pending deletion items will be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unreferenced">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                <p className="text-sm">Unreferenced blobs will be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}