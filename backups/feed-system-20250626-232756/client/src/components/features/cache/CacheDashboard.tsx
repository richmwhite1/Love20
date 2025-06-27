import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ApiService } from '@/lib/api-service';
import { cacheService } from '@/lib/cache-service';
import { imageCacheService } from '@/lib/image-cache-service';
import { swManager } from '@/lib/sw-registration';
import { 
  BarChart3, 
  Trash2, 
  RefreshCw, 
  HardDrive, 
  Wifi, 
  WifiOff,
  TrendingUp,
  Clock,
  Zap,
  Database
} from 'lucide-react';

interface CacheStats {
  cache: {
    hits: number;
    misses: number;
    size: number;
    lastCleanup: number;
  };
  imageCache: {
    size: number;
    entries: number;
    cacheSize: number;
  };
  serviceWorker?: any;
}

export const CacheDashboard: React.FC = () => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const cacheStats = cacheService.getStats();
      const imageStats = imageCacheService.getCacheStats();
      const swStats = await swManager.getCacheStats();

      setStats({
        cache: cacheStats,
        imageCache: imageStats,
        serviceWorker: swStats
      });
    } catch (error) {
      console.error('Failed to fetch cache stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch cache statistics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const clearAllCaches = async () => {
    setRefreshing(true);
    try {
      cacheService.clear();
      imageCacheService.clearCache();
      await swManager.clearCache();
      
      toast({
        title: 'Cache Cleared',
        description: 'All caches have been cleared successfully',
      });
      
      await fetchStats();
    } catch (error) {
      console.error('Failed to clear caches:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear caches',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const warmUserCache = async () => {
    setRefreshing(true);
    try {
      // Get current user ID from auth service
      const currentUser = await ApiService.get('/user');
      if (currentUser.success && currentUser.data?.id) {
        await ApiService.warmUserCache(currentUser.data.id);
        toast({
          title: 'Cache Warming',
          description: 'User cache has been warmed successfully',
        });
      }
    } catch (error) {
      console.error('Failed to warm user cache:', error);
      toast({
        title: 'Error',
        description: 'Failed to warm user cache',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getHitRate = () => {
    if (!stats?.cache) return 0;
    const { hits, misses } = stats.cache;
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  };

  const getImageCacheUsage = () => {
    if (!stats?.imageCache) return 0;
    const { size, cacheSize } = stats.imageCache;
    return cacheSize > 0 ? (size / cacheSize) * 100 : 0;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading cache statistics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cache Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage application caching performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchStats}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={warmUserCache}
            disabled={refreshing}
          >
            <Zap className="h-4 w-4 mr-2" />
            Warm Cache
          </Button>
          <Button
            variant="destructive"
            onClick={clearAllCaches}
            disabled={refreshing}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Cache Hit Rate */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getHitRate().toFixed(1)}%</div>
                <Progress value={getHitRate()} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {stats?.cache.hits || 0} hits, {stats?.cache.misses || 0} misses
                </p>
              </CardContent>
            </Card>

            {/* Cache Size */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Size</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.cache.size || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(stats?.imageCache.size || 0)} total
                </p>
              </CardContent>
            </Card>

            {/* Image Cache Usage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Image Cache</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getImageCacheUsage().toFixed(1)}%</div>
                <Progress value={getImageCacheUsage()} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {stats?.imageCache.entries || 0} images
                </p>
              </CardContent>
            </Card>

            {/* Service Worker Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Service Worker</CardTitle>
                {swManager.isOnline() ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {swManager.getState() || 'Inactive'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {swManager.isOnline() ? 'Online' : 'Offline'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cache Performance Alerts */}
          <div className="space-y-2">
            {getHitRate() < 50 && (
              <Alert>
                <AlertDescription>
                  Cache hit rate is low ({getHitRate().toFixed(1)}%). Consider adjusting cache strategies.
                </AlertDescription>
              </Alert>
            )}
            
            {getImageCacheUsage() > 80 && (
              <Alert>
                <AlertDescription>
                  Image cache usage is high ({getImageCacheUsage().toFixed(1)}%). Consider clearing old images.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cache Details */}
            <Card>
              <CardHeader>
                <CardTitle>Cache Details</CardTitle>
                <CardDescription>Application data cache statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Total Hits</TableCell>
                      <TableCell>{stats?.cache.hits || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Total Misses</TableCell>
                      <TableCell>{stats?.cache.misses || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Cache Entries</TableCell>
                      <TableCell>{stats?.cache.size || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Last Cleanup</TableCell>
                      <TableCell>
                        {stats?.cache.lastCleanup ? formatDate(stats.cache.lastCleanup) : 'Never'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Image Cache Details */}
            <Card>
              <CardHeader>
                <CardTitle>Image Cache Details</CardTitle>
                <CardDescription>Image optimization and caching</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Total Size</TableCell>
                      <TableCell>{formatBytes(stats?.imageCache.size || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Image Count</TableCell>
                      <TableCell>{stats?.imageCache.entries || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Max Size</TableCell>
                      <TableCell>{formatBytes(stats?.imageCache.cacheSize || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Usage</TableCell>
                      <TableCell>{getImageCacheUsage().toFixed(1)}%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Cache performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Hit Rate Trend */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Hit Rate Trend</span>
                    <Badge variant={getHitRate() > 70 ? 'default' : getHitRate() > 50 ? 'secondary' : 'destructive'}>
                      {getHitRate() > 70 ? 'Excellent' : getHitRate() > 50 ? 'Good' : 'Poor'}
                    </Badge>
                  </div>
                  <Progress value={getHitRate()} className="h-2" />
                </div>

                {/* Cache Efficiency */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Cache Efficiency</span>
                    <Badge variant="outline">
                      {stats?.cache.size || 0} entries
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Average response time improvement through caching
                  </div>
                </div>

                {/* Recommendations */}
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Recommendations</h4>
                  <ul className="text-sm space-y-1">
                    {getHitRate() < 50 && (
                      <li>• Increase cache TTL for frequently accessed data</li>
                    )}
                    {getImageCacheUsage() > 80 && (
                      <li>• Clear old images to free up space</li>
                    )}
                    {!swManager.getRegistration() && (
                      <li>• Enable service worker for offline functionality</li>
                    )}
                    <li>• Monitor cache performance regularly</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}; 