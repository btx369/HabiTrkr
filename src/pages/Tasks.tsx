import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, SlidingTabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Tasks() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('tasks');
  
  return (
    <Layout 
      pageTitle={t('tasks')}
      showSearch={true}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="fixed top-16 left-0 right-0 z-40 px-2">
          <div className="flex items-center justify-between py-2">
            <SlidingTabsList 
              activeValue={activeTab} 
              values={['tasks', 'folders', 'archived']}
            >
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="folders">Folders</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </SlidingTabsList>
          </div>
        </div>

        <TabsContent value="tasks" className="mt-14">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <p className="text-muted-foreground mt-2">Coming soon...</p>
          </div>
        </TabsContent>

        <TabsContent value="folders" className="mt-14">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <p className="text-muted-foreground mt-2">Coming soon...</p>
          </div>
        </TabsContent>

        <TabsContent value="archived" className="mt-14">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <p className="text-muted-foreground mt-2">Coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
