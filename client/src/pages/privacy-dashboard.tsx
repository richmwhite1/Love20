import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { ApiService } from '../lib/api-service';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { CalendarIcon, EyeIcon, ShieldIcon, UsersIcon, AlertTriangleIcon, DownloadIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ContentView {
  resourceType: string;
  resourceId: string;
  viewerId: string;
  viewerName: string;
  timestamp: Date;
  action: string;
}

interface PrivacyChange {
  field: string;
  oldValue: string;
  newValue: string;
  timestamp: Date;
}

interface FriendActivity {
  action: string;
  friendId: string;
  friendName: string;
  timestamp: Date;
}

interface ListAccess {
  listId: string;
  listName: string;
  action: string;
  collaboratorId?: string;
  collaboratorName?: string;
  timestamp: Date;
}

interface SuspiciousActivity {
  action: string;
  details: string;
  severity: string;
  timestamp: Date;
}

interface PrivacyDashboardData {
  contentViews: ContentView[];
  privacyChanges: PrivacyChange[];
  friendActivity: FriendActivity[];
  listAccess: ListAccess[];
  suspiciousActivity: SuspiciousActivity[];
}

export default function PrivacyDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<PrivacyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user) {
      loadPrivacyDashboard();
    }
  }, [user]);

  const loadPrivacyDashboard = async () => {
    try {
      setLoading(true);
      const response = await ApiService.get('/audit/privacy-dashboard');
      
      if (response.success) {
        setDashboardData(response.data as PrivacyDashboardData);
      } else {
        setError(response.message || 'Failed to load privacy dashboard');
      }
    } catch (err) {
      setError('Failed to load privacy dashboard');
      console.error('Error loading privacy dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportUserData = async () => {
    try {
      setExporting(true);
      const response = await ApiService.get('/audit/export-data');
      
      if (response.success) {
        // Create and download JSON file
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `user-data-${user?.id}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        setError(response.message || 'Failed to export data');
      }
    } catch (err) {
      setError('Failed to export user data');
      console.error('Error exporting user data:', err);
    } finally {
      setExporting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'content_view': return <EyeIcon className="h-4 w-4" />;
      case 'privacy_change': return <ShieldIcon className="h-4 w-4" />;
      case 'friend_request': return <UsersIcon className="h-4 w-4" />;
      case 'friend_accept': return <UsersIcon className="h-4 w-4" />;
      case 'unfriend': return <UsersIcon className="h-4 w-4" />;
      default: return <CalendarIcon className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Privacy Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your privacy activity and data access
          </p>
        </div>
        <Button 
          onClick={exportUserData} 
          disabled={exporting}
          className="flex items-center gap-2"
        >
          <DownloadIcon className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export Data (GDPR)'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Views</CardTitle>
            <EyeIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.contentViews.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Times your content was viewed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Privacy Changes</CardTitle>
            <ShieldIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.privacyChanges.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Settings you've changed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Friend Activity</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.friendActivity.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Friendship changes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Activity</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.suspiciousActivity.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Flagged activities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="content-views" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content-views">Content Views</TabsTrigger>
          <TabsTrigger value="privacy-changes">Privacy Changes</TabsTrigger>
          <TabsTrigger value="friend-activity">Friend Activity</TabsTrigger>
          <TabsTrigger value="list-access">List Access</TabsTrigger>
          <TabsTrigger value="suspicious">Suspicious Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="content-views" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Who Viewed Your Content</CardTitle>
              <CardDescription>
                Track who has accessed your posts, lists, and other content
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.contentViews.length === 0 ? (
                <p className="text-muted-foreground">No content views recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.contentViews.map((view, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getActionIcon(view.action)}
                        <div>
                          <p className="font-medium">{view.viewerName}</p>
                          <p className="text-sm text-muted-foreground">
                            Viewed your {view.resourceType} • {formatDistanceToNow(new Date(view.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{view.resourceType}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy-changes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Setting Changes</CardTitle>
              <CardDescription>
                History of your privacy setting modifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.privacyChanges.length === 0 ? (
                <p className="text-muted-foreground">No privacy changes recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.privacyChanges.map((change, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <ShieldIcon className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{change.field}</p>
                          <p className="text-sm text-muted-foreground">
                            {change.oldValue} → {change.newValue} • {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">Privacy</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="friend-activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Friendship Activity</CardTitle>
              <CardDescription>
                Track friend requests, accepts, and unfriends
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.friendActivity.length === 0 ? (
                <p className="text-muted-foreground">No friend activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.friendActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getActionIcon(activity.action)}
                        <div>
                          <p className="font-medium">{activity.friendName}</p>
                          <p className="text-sm text-muted-foreground">
                            {activity.action.replace('_', ' ')} • {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{activity.action}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list-access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>List Access & Collaboration</CardTitle>
              <CardDescription>
                Monitor who accesses and collaborates on your lists
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.listAccess.length === 0 ? (
                <p className="text-muted-foreground">No list access activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.listAccess.map((access, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{access.listName}</p>
                          <p className="text-sm text-muted-foreground">
                            {access.action} {access.collaboratorName && `by ${access.collaboratorName}`} • {formatDistanceToNow(new Date(access.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{access.action}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suspicious" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suspicious Activity</CardTitle>
              <CardDescription>
                Activities flagged as potentially suspicious
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.suspiciousActivity.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No suspicious activity detected. Your account appears secure!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.suspiciousActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg border-red-200 bg-red-50">
                      <div className="flex items-center gap-3">
                        <AlertTriangleIcon className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="font-medium">{activity.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {activity.details} • {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={getSeverityColor(activity.severity)}>
                        {activity.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 