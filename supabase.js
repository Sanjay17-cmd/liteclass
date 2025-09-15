// supabase.js (plain browser global helpers)
// Replace these with your project's values
const SUPABASE_URL = "https://mcfdqopvpnuwthfsedxl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZmRxb3B2cG51d3RoZnNlZHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NjA2OTIsImV4cCI6MjA3MzMzNjY5Mn0.paVRIb0iTd-nDAcCfdZC4lcihtUh_CdAgiOBAOPek4U";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose simple helper API to window
window.supabaseHelpers = {
  client: supabaseClient,

  // Users (custom auth table)
  users: {
    signup: async (username, password, role='student') => {
      return await supabaseClient.from('users').insert({ username, password, role }).select().single();
    },
    login: async (username, password) => {
      // simple direct lookup on users table
      return await supabaseClient.from('users').select('*').eq('username', username).eq('password', password).single();
    },
    list: async () => supabaseClient.from('users').select('*')
  },

  // Classes & lectures
  db: {
    getClasses: async (role, userId) => {
      if (role === 'teacher') {
        return await supabaseClient.from('classes').select('*').eq('teacher_id', userId);
      }
      return await supabaseClient.from('classes').select('*');
    },
    createClass: async (obj) => supabaseClient.from('classes').insert(obj).select(),
    getLectures: async (classId) => supabaseClient.from('lectures').select('*').eq('class_id', classId),
    createLecture: async (obj) => supabaseClient.from('lectures').insert(obj).select()
  },

submissions: {
  create: async (s) => {
    return await supabaseClient.from("submissions").insert(s).select().single();
  },
  listForAssignment: async (assignmentId) => {
    return await supabaseClient.from("submissions").select("*").eq("assignment_id", assignmentId);
  },
  listForStudent: async (studentId) => {
    return await supabaseClient.from("submissions").select("*").eq("student_id", studentId);
  },
  updateMarks: async (submissionId, marks) => {
    return await supabaseClient.from("submissions").update({ marks }).eq("id", submissionId);
  }
},


  // Storage helpers for lecture zips
  storage: {
    uploadLecture: async (fileBlob, path) => {
      // uploads to bucket 'lectures'
      return await supabaseClient.storage.from('lectures').upload(path, fileBlob, { upsert: true });
    },
    getPublicUrl: (path) => {
      return supabaseClient.storage.from('lectures').getPublicUrl(path);
    },
    downloadAsBlob: async (path) => {
      const { data, error } = await supabaseClient.storage.from('lectures').download(path);
      if (error) throw error;
      return data;
    }
  },

  // Quizzes & assignments (basic)
  quizzes: {
    create: async (q) => supabaseClient.from('quizzes').insert(q).select(),
   listForLecture: async (lectureId) => {
  if (!lectureId) {
    return supabaseClient.from('quizzes').select('*');
  }
  return supabaseClient.from('quizzes').select('*').eq('lecture_id', lectureId);
}

  },
assignments: {
  create: async (a) => supabaseClient.from('assignments').insert(a).select(),
  listForClass: async (classId) => {
    if (!classId) {
      return supabaseClient.from('assignments').select('*');
    }
    return supabaseClient.from('assignments').select('*').eq('class_id', classId);
  },
  listAll: async () => {
    return await supabaseClient
      .from("assignments")
      .select("*")
      .order("created_at", { ascending: false });
  }
},
  polls: {
  create: async (p) => supabaseClient.from("polls").insert(p).select().single(),
  listAll: async () => supabaseClient.from("polls").select("*")
},

pollResponses: {
  vote: async (pollId, studentId, option) => {
    // Upsert: if already exists, update; else insert
    return await supabaseClient.from("poll_responses")
      .upsert({ poll_id: pollId, student_id: studentId, option }, { onConflict: "poll_id,student_id" })
      .select()
      .single();
  },
  listForStudent: async (studentId) => {
    return await supabaseClient.from("poll_responses").select("*").eq("student_id", studentId);
  },
  listForPoll: async (pollId) => {
    return await supabaseClient.from("poll_responses").select("*").eq("poll_id", pollId);
  }
},

quizResponses: {
  answer: async (quizId, studentId, option, isCorrect) => {
    return await supabaseClient.from("quiz_responses")
      .upsert(
        { quiz_id: quizId, student_id: studentId, option, is_correct: isCorrect },
        { onConflict: "quiz_id,student_id" }
      )
      .select()
      .single();
  },
  listForStudent: async (studentId) => {
    return await supabaseClient.from("quiz_responses").select("*").eq("student_id", studentId);
  },
  listForQuiz: async (quizId) => {
    return await supabaseClient.from("quiz_responses").select("*").eq("quiz_id", quizId);
  }
},

rtc: {
  // Create or join a channel for signaling
  joinChannel: (channelName, callbacks = {}) => {
    const channel = supabaseClient.channel(channelName, {
      config: {
        broadcast: { ack: true }
      }
    });

    // Listen for broadcasts
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      if (callbacks.onSignal) callbacks.onSignal(payload);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && callbacks.onJoin) callbacks.onJoin(channel);
    });

    return channel;
  },

  // Send signaling data
  sendSignal: (channel, data) => {
    channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: data
    });
  }
}

};

// Expose client globally as well (for compatibility with old code)
window.supabase = supabaseClient;