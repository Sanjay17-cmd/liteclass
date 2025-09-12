// Supabase Configuration and Helpers
const SUPABASE_URL = 'https://njhlttbnzadwoyjeuubx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qaGx0dGJuemFkd295amV1dWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMjg4OTYsImV4cCI6MjA3MjgwNDg5Nn0.FrlGEx2beL9bOPRL_BDriXkBDDyNTSzT-7LAS_eriS4';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth helpers
const auth = {
  async signUp(email, password, role = 'student') {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role }
        }
      });
      
      if (error) throw error;
      
      // Create user profile
      if (data.user) {
        await this.createUserProfile(data.user.id, email, role);
      }
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (user) {
        const profile = await this.getUserProfile(user.id);
        return { ...user, profile };
      }
      
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  async createUserProfile(userId, email, role) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            email,
            role,
            created_at: new Date().toISOString()
          }
        ]);
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  },

  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Storage helpers
const storage = {
  async uploadLecture(file, fileName) {
    try {
      const { data, error } = await supabase.storage
        .from('lectures')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async downloadLecture(fileName) {
    try {
      const { data, error } = await supabase.storage
        .from('lectures')
        .download(fileName);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async listLectures(userId = null) {
    try {
      let query = supabase
        .from('lectures')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (userId) {
        query = query.eq('teacher_id', userId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteLecture(fileName) {
    try {
      const { data, error } = await supabase.storage
        .from('lectures')
        .remove([fileName]);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getPublicUrl(fileName) {
    const { data } = supabase.storage
      .from('lectures')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  }
};

// Database helpers
const database = {
  async createLecture(lectureData) {
    try {
      const { data, error } = await supabase
        .from('lectures')
        .insert([lectureData])
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateLecture(id, updates) {
    try {
      const { data, error } = await supabase
        .from('lectures')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getLectures(filters = {}) {
    try {
      let query = supabase
        .from('lectures')
        .select(`
          *,
          profiles:teacher_id (
            email,
            role
          )
        `)
        .order('created_at', { ascending: false });
      
      if (filters.subject) {
        query = query.eq('subject', filters.subject);
      }
      
      if (filters.teacher_id) {
        query = query.eq('teacher_id', filters.teacher_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createAssignment(assignmentData) {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert([assignmentData])
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getAssignments(filters = {}) {
    try {
      let query = supabase
        .from('assignments')
        .select(`
          *,
          profiles:teacher_id (
            email,
            role
          )
        `)
        .order('created_at', { ascending: false });
      
      if (filters.subject) {
        query = query.eq('subject', filters.subject);
      }
      
      if (filters.teacher_id) {
        query = query.eq('teacher_id', filters.teacher_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async submitAssignment(submissionData) {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .insert([submissionData])
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getQuizResponses(lectureId, studentId) {
    try {
      const { data, error } = await supabase
        .from('quiz_responses')
        .select('*')
        .eq('lecture_id', lectureId)
        .eq('student_id', studentId);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async submitQuizResponse(responseData) {
    try {
      const { data, error } = await supabase
        .from('quiz_responses')
        .insert([responseData])
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getSubjects() {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createSubject(name) {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert([{ name }])
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteSubject(id) {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Realtime helpers
const realtime = {
  subscribeToLiveClass(classId, callback) {
    return supabase
      .channel(`live_class_${classId}`)
      .on('broadcast', { event: 'slide_change' }, callback)
      .on('broadcast', { event: 'class_start' }, callback)
      .on('broadcast', { event: 'class_end' }, callback)
      .subscribe();
  },

  broadcastSlideChange(classId, slideIndex) {
    return supabase
      .channel(`live_class_${classId}`)
      .send({
        type: 'broadcast',
        event: 'slide_change',
        payload: { slideIndex, timestamp: Date.now() }
      });
  },

  broadcastClassStart(classId, lectureData) {
    return supabase
      .channel(`live_class_${classId}`)
      .send({
        type: 'broadcast',
        event: 'class_start',
        payload: { lectureData, timestamp: Date.now() }
      });
  },

  broadcastClassEnd(classId) {
    return supabase
      .channel(`live_class_${classId}`)
      .send({
        type: 'broadcast',
        event: 'class_end',
        payload: { timestamp: Date.now() }
      });
  },

  unsubscribe(subscription) {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
};

// Notification helpers
const notifications = {
  async sendNotification(userId, title, message, type = 'info') {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          title,
          message,
          type,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getNotifications(userId) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async markAsRead(notificationId) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  subscribeToNotifications(userId, callback) {
    return supabase
      .channel(`notifications_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  }
};

// Export all helpers
window.supabaseHelpers = {
  client: supabaseClient,
  auth,
  storage,
  database,
  realtime,
  notifications
};
