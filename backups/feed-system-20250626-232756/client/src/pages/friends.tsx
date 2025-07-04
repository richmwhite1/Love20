import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, Users, Check, X, Bell, Clock, UserMinus } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import AuricField from "@/components/auric-field";
import type { User } from "@shared/schema";

interface ConnectionRequest {
  id: number;
  fromUser: User;
  createdAt: Date;
}

export default function ConnectionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const { toast } = useToast();
  const { isAuthenticated, user, getIdToken } = useAuth();
  const queryClient = useQueryClient();

  // Get current connections
  const { data: connections = [] } = useQuery<User[]>({
    queryKey: ['/api/friends'],
    queryFn: getQueryFn({ on401: "throw", getToken: getIdToken }),
    enabled: isAuthenticated,
  });

  // Get connection requests
  const { data: friendRequests = [] } = useQuery<ConnectionRequest[]>({
    queryKey: ['/api/friend-requests'],
    queryFn: getQueryFn({ on401: "throw", getToken: getIdToken }),
    enabled: isAuthenticated,
  });
  const connectionRequests = friendRequests;

  // Get outgoing follow requests
  const { data: outgoingRequests = [] } = useQuery<Array<{ id: number; toUser: User; createdAt: Date }>>({
    queryKey: ['/api/outgoing-friend-requests'],
    queryFn: getQueryFn({ on401: "throw", getToken: getIdToken }),
    enabled: isAuthenticated,
  });

  // Load all users using the working search endpoint
  const { data: allUsersData = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/search/users', 'all'],
    queryFn: async () => {
      const token = await getIdToken();
      const response = await fetch('/api/search/users?q=', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to load users');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Update filtered users when data changes
  useEffect(() => {
    if (allUsersData.length > 0) {
      setAllUsers(allUsersData);
      // Filter out current user and existing connections
      const filtered = allUsersData.filter((u: User) => {
        const isCurrentUser = u.id === user?.id;
        const isConnected = connections.some((conn: any) => conn.id === u.id);
        return !isCurrentUser && !isConnected;
      });
      setFilteredUsers(filtered);
    }
  }, [allUsersData, user?.id, connections.length]);

  // Handle search filtering
  useEffect(() => {
    if (!searchTerm.trim()) {
      // Show all users except current user and existing connections
      const filtered = allUsers.filter((u: User) => {
        const isCurrentUser = u.id === user?.id;
        const isConnected = connections.some((conn: any) => conn.id === u.id);
        return !isCurrentUser && !isConnected;
      });
      setFilteredUsers(filtered);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = allUsers.filter((u: User) => {
        const isCurrentUser = u.id === user?.id;
        const isConnected = connections.some((conn: any) => conn.id === u.id);
        const matchesSearch = u.username.toLowerCase().includes(searchLower) ||
                            u.name.toLowerCase().includes(searchLower);
        return !isCurrentUser && !isConnected && matchesSearch;
      });
      setFilteredUsers(filtered);
    }
  }, [searchTerm, allUsers.length, user?.id, connections.length]);

  // Send follow request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async (toUserId: number) => {
      const token = await getIdToken();
      return apiRequest('POST', '/api/friends/send-request', { friendId: toUserId }, token);
    },
    onSuccess: () => {
      toast({
        title: "Connection request sent",
        description: "Your connection request has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/outgoing-friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      // Remove optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['/api/outgoing-friend-requests'] });
      toast({
        title: "Error",
        description: error.message || "Failed to send connection request",
        variant: "destructive",
      });
    },
  });

  // Accept follow request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const token = await getIdToken();
      return apiRequest('POST', `/api/friend-request/${requestId}/respond`, { 
        action: 'accept' 
      }, token);
    },
    onSuccess: () => {
      toast({
        title: "Connection accepted",
        description: "You are now connected with this user.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept request",
        description: error.message || "Could not accept follow request.",
        variant: "destructive",
      });
    },
  });

  // Reject friend request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const token = await getIdToken();
      return apiRequest('POST', `/api/friend-request/${requestId}/respond`, { 
        action: 'reject' 
      }, token);
    },
    onSuccess: () => {
      toast({
        title: "Friend request rejected",
        description: "The request has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject request",
        description: error.message || "Could not reject friend request.",
        variant: "destructive",
      });
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async (friendId: number) => {
      const token = await getIdToken();
      return apiRequest('DELETE', `/api/friends/${friendId}`, token);
    },
    onSuccess: () => {
      toast({
        title: "Connection removed",
        description: "You are no longer connected.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/search/users', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/outgoing-friend-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unfollow",
        description: error.message || "Could not remove connection.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSendRequest = (toUserId: string) => {
    // Optimistically update the outgoing requests cache
    queryClient.setQueryData(['/api/outgoing-friend-requests'], (old: any) => [
      ...(old || []),
      { 
        id: Date.now(), 
        toUser: filteredUsers.find(u => u.id === toUserId),
        createdAt: new Date() 
      }
    ]);
    
    sendRequestMutation.mutate(parseInt(toUserId));
  };

  const handleAcceptRequest = (requestId: string) => {
    acceptRequestMutation.mutate(parseInt(requestId));
  };

  const handleRejectRequest = (requestId: string) => {
    rejectRequestMutation.mutate(parseInt(requestId));
  };

  const handleUnfollow = (friendId: string) => {
    unfollowMutation.mutate(parseInt(friendId));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Please sign in to manage your friends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="connections" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connections" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Connections ({connections.length})
              </TabsTrigger>
              <TabsTrigger value="find" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Find People
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Requests ({connectionRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connections" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Your Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  {connections.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        You don't have any connections yet.
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        Use the "Find People" tab to connect with others!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {connections.map((connection) => (
                        <div
                          key={connection.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center space-x-3">
                            <Link href={`/profile/${connection.id}`}>
                              <AuricField profileId={parseInt(connection.id)} intensity={0.2}>
                                <Avatar className="cursor-pointer hover:opacity-80 transition-opacity w-16 h-16">
                                  <AvatarImage 
                                    src={connection.profilePictureUrl || undefined} 
                                    alt={connection.name}
                                  />
                                  <AvatarFallback className="text-lg">
                                    {connection.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </AuricField>
                            </Link>
                            <div>
                              <Link href={`/profile/${connection.id}`} className="cursor-pointer hover:opacity-80 transition-opacity">
                                <p className="font-medium text-gray-100 dark:text-gray-100">
                                  {connection.name}
                                </p>
                              </Link>
                              <p className="text-sm text-gray-300 dark:text-gray-300">
                                @{connection.username}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => handleUnfollow(connection.id.toString())}
                              disabled={unfollowMutation.isPending}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                            >
                              <UserMinus className="h-4 w-4" />
                              Unfollow
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="find" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Find People</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search users by name or username..."
                        value={searchTerm}
                        onChange={handleSearch}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {usersLoading ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400">Loading users...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredUsers.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-600 dark:text-gray-400">
                            {searchTerm ? 'No users found matching your search.' : 'No users available.'}
                          </p>
                        </div>
                      ) : (
                        filteredUsers.map((searchUser) => {
                          const isConnected = connections.some((f: any) => f.id === searchUser.id);
                          const hasPendingRequest = connectionRequests.some((req: any) => req.fromUser.id === searchUser.id);
                          const hasOutgoingRequest = outgoingRequests.some(req => req.toUser.id === searchUser.id);
                          
                          return (
                            <div
                              key={searchUser.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <div className="flex items-center space-x-3">
                                <Link href={`/profile/${searchUser.id}`}>
                                  <AuricField profileId={parseInt(searchUser.id)} intensity={0.2}>
                                    <Avatar className="cursor-pointer hover:opacity-80 transition-opacity w-16 h-16">
                                      <AvatarImage 
                                        src={searchUser.profilePictureUrl || undefined} 
                                        alt={searchUser.name}
                                      />
                                      <AvatarFallback className="text-lg">
                                        {searchUser.name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </AuricField>
                                </Link>
                                <div>
                                  <Link href={`/profile/${searchUser.id}`} className="cursor-pointer hover:opacity-80 transition-opacity">
                                    <p className="font-medium text-gray-100 dark:text-gray-100">
                                      {searchUser.name}
                                    </p>
                                  </Link>
                                  <p className="text-sm text-gray-300 dark:text-gray-300">
                                    @{searchUser.username}
                                  </p>
                                  {isConnected && (
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                      Connected
                                    </p>
                                  )}
                                  {hasPendingRequest && (
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                      Request received
                                    </p>
                                  )}
                                  {hasOutgoingRequest && (
                                    <p className="text-xs text-blue-600 dark:text-blue-400">
                                      Request sent
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isConnected ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  className="flex items-center gap-2"
                                >
                                  <Check className="h-4 w-4" />
                                  Connected
                                </Button>
                              ) : hasPendingRequest ? (
                                <div className="flex items-center space-x-2">
                                  <Button
                                    onClick={() => {
                                      const request = connectionRequests.find((req: any) => req.fromUser.id === searchUser.id);
                                      if (request) handleAcceptRequest(request.id.toString());
                                    }}
                                    disabled={acceptRequestMutation.isPending}
                                    size="sm"
                                    className="flex items-center gap-2"
                                  >
                                    <Check className="h-4 w-4" />
                                    Accept
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      const request = connectionRequests.find((req: any) => req.fromUser.id === searchUser.id);
                                      if (request) handleRejectRequest(request.id.toString());
                                    }}
                                    disabled={rejectRequestMutation.isPending}
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                  >
                                    <X className="h-4 w-4" />
                                    Decline
                                  </Button>
                                </div>
                              ) : hasOutgoingRequest ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex items-center gap-2 bg-blue-50 text-blue-600 border-blue-300"
                                >
                                  <Check className="h-4 w-4" />
                                  Following
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => handleSendRequest(searchUser.id.toString())}
                                  disabled={sendRequestMutation.isPending}
                                  size="sm"
                                  className="flex items-center gap-2"
                                >
                                  <UserPlus className="h-4 w-4" />
                                  Follow
                                </Button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requests" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Connection Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {connectionRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400">
                        No pending connection requests.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {connectionRequests.map((request: any) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <Link href={`/profile/${request.fromUser.id}`}>
                              <AuricField profileId={parseInt(request.fromUser.id)} intensity={0.2}>
                                <Avatar className="cursor-pointer hover:opacity-80 transition-opacity w-16 h-16">
                                  <AvatarImage 
                                    src={request.fromUser.profilePictureUrl || undefined} 
                                    alt={request.fromUser.name}
                                  />
                                  <AvatarFallback className="text-lg">
                                    {request.fromUser.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </AuricField>
                            </Link>
                            <div>
                              <Link href={`/profile/${request.fromUser.id}`} className="cursor-pointer hover:opacity-80 transition-opacity">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {request.fromUser.name}
                                </p>
                              </Link>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                @{request.fromUser.username}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => handleAcceptRequest(request.id.toString())}
                              disabled={acceptRequestMutation.isPending}
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Check className="h-4 w-4" />
                              Accept
                            </Button>
                            <Button
                              onClick={() => handleRejectRequest(request.id.toString())}
                              disabled={rejectRequestMutation.isPending}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <X className="h-4 w-4" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}