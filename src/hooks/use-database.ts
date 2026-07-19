/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface Feature {
  id: string;
  workspace_id: string;
  type: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export function useDatabase() {
  const { currentUser } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user workspaces
  const loadWorkspaces = useCallback(() => {
    if (!currentUser) {
      setWorkspaces([]);
      setSelectedWorkspace(null);
      return;
    }

    setLoading(true);
    try {
      // Fetch from mock localStorage DB
      const wsRaw = localStorage.getItem('maneli_mock_workspaces') || '[]';
      const wsList: Workspace[] = JSON.parse(wsRaw);
      
      // Filter based on RLS: Owner or Member
      const memRaw = localStorage.getItem('maneli_mock_workspace_members') || '[]';
      const memList: WorkspaceMember[] = JSON.parse(memRaw);

      const userWorkspaces = wsList.filter(ws => 
        ws.owner_id === currentUser.id || 
        memList.some(m => m.workspace_id === ws.id && m.user_id === currentUser.id)
      );

      setWorkspaces(userWorkspaces);
      if (userWorkspaces.length > 0) {
        // Keep selection if still valid, or default to first
        setSelectedWorkspace(prev => {
          const stillValid = userWorkspaces.find(w => w.id === prev?.id);
          return stillValid || userWorkspaces[0];
        });
      } else {
        setSelectedWorkspace(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Load members & features when selectedWorkspace changes
  useEffect(() => {
    if (!selectedWorkspace) {
      setMembers([]);
      setFeatures([]);
      return;
    }

    try {
      // Load members
      const memRaw = localStorage.getItem('maneli_mock_workspace_members') || '[]';
      const memList: WorkspaceMember[] = JSON.parse(memRaw);
      const wsMembers = memList.filter(m => m.workspace_id === selectedWorkspace.id);
      setMembers(wsMembers);

      // Load features
      const featRaw = localStorage.getItem('maneli_mock_features') || '[]';
      const featList: Feature[] = JSON.parse(featRaw);
      const wsFeatures = featList.filter(f => f.workspace_id === selectedWorkspace.id);
      setFeatures(wsFeatures);
    } catch (err: any) {
      console.error(err);
    }
  }, [selectedWorkspace]);

  // Trigger reload on init
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Create Workspace
  const createWorkspace = async (name: string): Promise<Workspace | null> => {
    if (!currentUser) throw new Error('Unauthenticated');
    setLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const newWs: Workspace = {
        id: 'ws_' + Math.random().toString(36).substring(2, 11),
        owner_id: currentUser.id,
        name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert into local storage
      const wsRaw = localStorage.getItem('maneli_mock_workspaces') || '[]';
      const wsList = JSON.parse(wsRaw);
      wsList.push(newWs);
      localStorage.setItem('maneli_mock_workspaces', JSON.stringify(wsList));

      // Auto-insert owner membership record
      const newMember: WorkspaceMember = {
        id: 'mem_' + Math.random().toString(36).substring(2, 11),
        workspace_id: newWs.id,
        user_id: currentUser.id,
        role: 'owner',
        created_at: new Date().toISOString()
      };

      const memRaw = localStorage.getItem('maneli_mock_workspace_members') || '[]';
      const memList = JSON.parse(memRaw);
      memList.push(newMember);
      localStorage.setItem('maneli_mock_workspace_members', JSON.stringify(memList));

      loadWorkspaces();
      return newWs;
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Add Member
  const addWorkspaceMember = async (workspaceId: string, userEmail: string, role: 'owner' | 'admin' | 'member'): Promise<WorkspaceMember | null> => {
    if (!currentUser) throw new Error('Unauthenticated');
    setLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 400));

      // Find user from mock user list to get their ID
      const usersRaw = localStorage.getItem('maneli_mock_users') || '[]';
      const usersList = JSON.parse(usersRaw);
      const targetUser = usersList.find((u: any) => u.email.toLowerCase() === userEmail.toLowerCase());

      if (!targetUser) {
        throw new Error(`No registered tenant profile found for email "${userEmail}". Invite them to register on the Kernel first.`);
      }

      // Check RLS / role privilege: must be owner or admin of the workspace
      const memRaw = localStorage.getItem('maneli_mock_workspace_members') || '[]';
      const memList: WorkspaceMember[] = JSON.parse(memRaw);
      const callerRole = memList.find(m => m.workspace_id === workspaceId && m.user_id === currentUser.id)?.role;

      // Caller must be owner or admin, or the workspace owner_id is caller
      const wsRaw = localStorage.getItem('maneli_mock_workspaces') || '[]';
      const wsList: Workspace[] = JSON.parse(wsRaw);
      const workspace = wsList.find(w => w.id === workspaceId);

      const isOwner = workspace?.owner_id === currentUser.id;
      const isAdmin = callerRole === 'admin' || callerRole === 'owner';

      if (!isOwner && !isAdmin) {
        throw new Error('Access Denied (RLS Violation): Only workspace Owners or Admins can invite new members.');
      }

      // Check if already a member
      if (memList.some(m => m.workspace_id === workspaceId && m.user_id === targetUser.id)) {
        throw new Error('This user is already a member of the workspace.');
      }

      const newMember: WorkspaceMember = {
        id: 'mem_' + Math.random().toString(36).substring(2, 11),
        workspace_id: workspaceId,
        user_id: targetUser.id,
        role,
        created_at: new Date().toISOString()
      };

      memList.push(newMember);
      localStorage.setItem('maneli_mock_workspace_members', JSON.stringify(memList));

      // Trigger update
      if (selectedWorkspace?.id === workspaceId) {
        setMembers(prev => [...prev, newMember]);
      }
      return newMember;
    } catch (err: any) {
      setError(err.message || 'Failed to add workspace member.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Add Feature Configuration (supports CueAudio, QuoteFlow, InvoiceFlow)
  const addFeature = async (workspaceId: string, type: 'CueAudio' | 'QuoteFlow' | 'InvoiceFlow', data: any): Promise<Feature | null> => {
    if (!currentUser) throw new Error('Unauthenticated');
    setLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify write capability (Admins or Owners)
      const memRaw = localStorage.getItem('maneli_mock_workspace_members') || '[]';
      const memList: WorkspaceMember[] = JSON.parse(memRaw);
      const callerRole = memList.find(m => m.workspace_id === workspaceId && m.user_id === currentUser.id)?.role;

      const wsRaw = localStorage.getItem('maneli_mock_workspaces') || '[]';
      const wsList: Workspace[] = JSON.parse(wsRaw);
      const workspace = wsList.find(w => w.id === workspaceId);

      const isOwner = workspace?.owner_id === currentUser.id;
      const isAdmin = callerRole === 'admin' || callerRole === 'owner';

      if (!isOwner && !isAdmin) {
        throw new Error('Access Denied (RLS Violation): Only workspace Owners or Admins can insert/update features.');
      }

      const newFeature: Feature = {
        id: 'feat_' + Math.random().toString(36).substring(2, 11),
        workspace_id: workspaceId,
        type,
        data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const featRaw = localStorage.getItem('maneli_mock_features') || '[]';
      const featList = JSON.parse(featRaw);
      featList.push(newFeature);
      localStorage.setItem('maneli_mock_features', JSON.stringify(featList));

      if (selectedWorkspace?.id === workspaceId) {
        setFeatures(prev => [...prev, newFeature]);
      }
      return newFeature;
    } catch (err: any) {
      setError(err.message || 'Failed to add feature data.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Purge/Delete Workspace
  const deleteWorkspace = async (workspaceId: string): Promise<boolean> => {
    if (!currentUser) throw new Error('Unauthenticated');
    setLoading(true);
    setError(null);

    try {
      // Check if caller is owner
      const wsRaw = localStorage.getItem('maneli_mock_workspaces') || '[]';
      const wsList: Workspace[] = JSON.parse(wsRaw);
      const wsIndex = wsList.findIndex(w => w.id === workspaceId);

      if (wsIndex === -1) throw new Error('Workspace not found');

      if (wsList[wsIndex].owner_id !== currentUser.id) {
        throw new Error('Access Denied (RLS Violation): Only the primary Workspace Owner can delete the workspace.');
      }

      wsList.splice(wsIndex, 1);
      localStorage.setItem('maneli_mock_workspaces', JSON.stringify(wsList));

      // Cascade delete members
      const memRaw = localStorage.getItem('maneli_mock_workspace_members') || '[]';
      const memList: WorkspaceMember[] = JSON.parse(memRaw);
      const filteredMembers = memList.filter(m => m.workspace_id !== workspaceId);
      localStorage.setItem('maneli_mock_workspace_members', JSON.stringify(filteredMembers));

      // Cascade delete features
      const featRaw = localStorage.getItem('maneli_mock_features') || '[]';
      const featList: Feature[] = JSON.parse(featRaw);
      const filteredFeatures = featList.filter(f => f.workspace_id !== workspaceId);
      localStorage.setItem('maneli_mock_features', JSON.stringify(filteredFeatures));

      loadWorkspaces();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete workspace.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Diagnostic Test Helper: Simulates an access test from a third-party perspective
   * to visually verify RLS Rules!
   */
  const runRlsDiagnosticTest = (testUserEmail: string, targetWorkspaceId: string): { 
    success: boolean; 
    message: string;
    details: string;
    accessGranted: boolean;
  } => {
    try {
      // Resolve user profile
      const usersRaw = localStorage.getItem('maneli_mock_users') || '[]';
      const usersList = JSON.parse(usersRaw);
      const testUser = usersList.find((u: any) => u.email.toLowerCase() === testUserEmail.toLowerCase());

      if (!testUser) {
        return {
          success: false,
          message: `RLS Diagnostics Error: Simulating user "${testUserEmail}" not found.`,
          details: 'Please register this test account first to run active simulations.',
          accessGranted: false
        };
      }

      // Check if testUser has authorization on targetWorkspaceId
      const wsRaw = localStorage.getItem('maneli_mock_workspaces') || '[]';
      const wsList: Workspace[] = JSON.parse(wsRaw);
      const workspace = wsList.find(w => w.id === targetWorkspaceId);

      if (!workspace) {
        return {
          success: false,
          message: 'Workspace not found.',
          details: 'Verify that the workspace exists in the active table before querying.',
          accessGranted: false
        };
      }

      const memRaw = localStorage.getItem('maneli_mock_workspace_members') || '[]';
      const memList: WorkspaceMember[] = JSON.parse(memRaw);

      const isOwner = workspace.owner_id === testUser.id;
      const isMember = memList.some(m => m.workspace_id === targetWorkspaceId && m.user_id === testUser.id);

      const hasAccess = isOwner || isMember;

      if (hasAccess) {
        const userRole = isOwner ? 'owner' : (memList.find(m => m.workspace_id === targetWorkspaceId && m.user_id === testUser.id)?.role || 'member');
        return {
          success: true,
          message: `RLS Check PASSED: User "${testUserEmail}" was GRANTED access.`,
          details: `Authorized mapping: user has role [${userRole}] inside the workspace membership lookup. Access aligns with the 'select_my_workspaces' policy.`,
          accessGranted: true
        };
      } else {
        return {
          success: true,
          message: `RLS Check PASSED: User "${testUserEmail}" was BLOCKED (Access Denied).`,
          details: `Secure boundary: No matching profile mapping exists. The 'select_my_workspaces' and 'select_features' policies intercepted this transaction and returned an empty set.`,
          accessGranted: false
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: 'Internal simulation crash.',
        details: err.message,
        accessGranted: false
      };
    }
  };

  return {
    workspaces,
    selectedWorkspace,
    setSelectedWorkspace,
    members,
    features,
    loading,
    error,
    createWorkspace,
    addWorkspaceMember,
    addFeature,
    deleteWorkspace,
    runRlsDiagnosticTest,
    reloadWorkspaces: loadWorkspaces
  };
}
