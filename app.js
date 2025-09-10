// LiteClass - Production Ready Application Logic
class LiteClassApp {
  constructor() {
    this.currentUser = null;
    this.currentLecture = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStartTime = null;
    this.slideEvents = [];
    this.currentSlideIndex = 0;
    this.slides = [];
    this.quizzes = [];
    this.isRecording = false;
    this.isPlaying = false;
    this.audioElement = null;
    this.syncInterval = null;
    this.liveClassSubscription = null;
    this.notificationSubscription = null;
    this.currentLanguage = 'en';
    this.translations = {};
    this.offlineQueue = [];
    
    this.initializeApp();
  }

  async initializeApp() {
    try {
      this.showScreen('loading-screen');
      await this.loadTranslations();
      await this.initializeDatabase();
      await this.checkAuthState();
      await this.initializeServiceWorker();
      this.setupEventListeners();
      this.startConnectionMonitoring();
      this.startStorageMonitoring();
      this.scheduleAutoSync();
    } catch (error) {
      console.error('App initialization failed:', error);
      this.showNotification('Initialization failed', 'error');
    }
  }

  async loadTranslations() {
    this.translations = {
      en: {
        welcome: 'Welcome to LiteClass',
        login: 'Login',
        signup: 'Sign Up',
        teacher: 'Teacher',
        student: 'Student',
        admin: 'Admin',
        offline: 'Continue Offline'
      },
      hi: {
        welcome: 'लाइटक्लास में आपका स्वागत है',
        login: 'लॉग इन',
        signup: 'साइन अप',
        teacher: 'शिक्षक',
        student: 'छात्र',
        admin: 'व्यवस्थापक',
        offline: 'ऑफ़लाइन जारी रखें'
      }
    };
  }

  async initializeDatabase() {
    // Initialize IndexedDB for offline storage
    this.db = new Dexie('LiteClassDB');
    this.db.version(1).stores({
      lectures: '++id, title, subject, teacher_id, file_path, downloaded_at',
      assignments: '++id, title, subject, teacher_id, due_date, submitted',
      quiz_responses: '++id, lecture_id, question_id, answer, timestamp',
      sync_queue: '++id, type, data, timestamp, retries'
    });
    
    await this.db.open();
  }

  async checkAuthState() {
    const { data: { session } } = await supabaseHelpers.client.auth.getSession();
    
    if (session) {
      this.currentUser = await supabaseHelpers.auth.getCurrentUser();
      this.showDashboard();
    } else {
      this.showScreen('login-screen');
    }
  }

  async initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker registered:', registration.scope);
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'SYNC_COMPLETE') {
            this.showNotification('Sync completed', 'success');
          }
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  setupEventListeners() {
    // Auth form
    document.getElementById('auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAuth();
    });

    // Tab switching
    document.getElementById('login-tab').addEventListener('click', () => {
      this.switchAuthTab('login');
    });
    
    document.getElementById('signup-tab').addEventListener('click', () => {
      this.switchAuthTab('signup');
    });

    // Offline mode
    document.getElementById('offline-btn').addEventListener('click', () => {
      this.enterOfflineMode();
    });

    // Teacher controls
    document.getElementById('start-recording').addEventListener('click', () => {
      this.startRecording();
    });
    
    document.getElementById('stop-recording').addEventListener('click', () => {
      this.stopRecording();
    });

    // Slide controls during recording
    document.getElementById('prev-slide-rec').addEventListener('click', () => {
      this.previousSlide();
    });
    
    document.getElementById('next-slide-rec').addEventListener('click', () => {
      this.nextSlide();
    });
    
    document.getElementById('annotate-btn').addEventListener('click', () => {
      this.addAnnotation();
    });

    // Quiz builder
    document.getElementById('add-quiz').addEventListener('click', () => {
      this.addQuizQuestion();
    });

    // Build and upload
    document.getElementById('build-lecture').addEventListener('click', () => {
      this.buildLecturePackage();
    });
    
    document.getElementById('upload-lecture').addEventListener('click', () => {
      this.uploadLecture();
    });

    // File inputs
    document.getElementById('slides-input').addEventListener('change', (e) => {
      this.handleSlidesUpload(e.target.files);
    });
    
    document.getElementById('import-zip').addEventListener('change', (e) => {
      this.importLectureZip(e.target.files[0]);
    });

    // Player controls
    document.getElementById('player-play').addEventListener('click', () => {
      this.togglePlayback();
    });
    
    document.getElementById('player-prev').addEventListener('click', () => {
      this.playerPreviousSlide();
    });
    
    document.getElementById('player-next').addEventListener('click', () => {
      this.playerNextSlide();
    });

    // Live class controls
    document.getElementById('start-live').addEventListener('click', () => {
      this.startLiveClass();
    });
    
    document.getElementById('end-live').addEventListener('click', () => {
      this.endLiveClass();
    });

    // Language toggle
    document.getElementById('lang-toggle').addEventListener('click', () => {
      this.showLanguageModal();
    });

    // Dashboard tabs
    this.setupDashboardTabs();
    
    // Logout buttons
    document.getElementById('teacher-logout').addEventListener('click', () => {
      this.logout();
    });
    
    document.getElementById('student-logout').addEventListener('click', () => {
      this.logout();
    });
    
    document.getElementById('admin-logout').addEventListener('click', () => {
      this.logout();
    });
  }

  setupDashboardTabs() {
    // Teacher tabs
    document.getElementById('create-tab').addEventListener('click', () => {
      this.showTab('create-lecture', 'create-tab');
    });
    
    document.getElementById('live-tab').addEventListener('click', () => {
      this.showTab('live-class', 'live-tab');
    });
    
    document.getElementById('manage-tab').addEventListener('click', () => {
      this.showTab('manage-content', 'manage-tab');
    });

    // Student tabs
    document.getElementById('lectures-tab').addEventListener('click', () => {
      this.showTab('student-lectures', 'lectures-tab');
    });
    
    document.getElementById('assignments-tab').addEventListener('click', () => {
      this.showTab('student-assignments', 'assignments-tab');
    });
    
    document.getElementById('progress-tab').addEventListener('click', () => {
      this.showTab('student-progress', 'progress-tab');
    });
  }

  async handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const role = document.getElementById('auth-role').value;
    const isLogin = document.getElementById('login-tab').classList.contains('active');

    try {
      let result;
      if (isLogin) {
        result = await supabaseHelpers.auth.signIn(email, password);
      } else {
        result = await supabaseHelpers.auth.signUp(email, password, role);
      }

      if (result.error) {
        throw result.error;
      }

      this.currentUser = await supabaseHelpers.auth.getCurrentUser();
      this.showDashboard();
      this.showNotification(isLogin ? 'Logged in successfully' : 'Account created successfully', 'success');
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }

  switchAuthTab(tab) {
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const submitBtn = document.getElementById('auth-submit');

    if (tab === 'login') {
      loginTab.classList.add('active');
      signupTab.classList.remove('active');
      submitBtn.textContent = 'Login';
    } else {
      signupTab.classList.add('active');
      loginTab.classList.remove('active');
      submitBtn.textContent = 'Sign Up';
    }
  }

  showDashboard() {
    if (!this.currentUser) return;

    const role = this.currentUser.profile?.role || 'student';
    
    switch (role) {
      case 'teacher':
        this.showScreen('teacher-screen');
        this.loadTeacherData();
        break;
      case 'student':
        this.showScreen('student-screen');
        this.loadStudentData();
        break;
      case 'admin':
        this.showScreen('admin-screen');
        this.loadAdminData();
        break;
      default:
        this.showScreen('student-screen');
        this.loadStudentData();
    }

    this.setupNotifications();
  }

  async loadTeacherData() {
    try {
      const { data: lectures } = await supabaseHelpers.database.getLectures({
        teacher_id: this.currentUser.id
      });
      
      this.renderTeacherLectures(lectures || []);
      
      const { data: subjects } = await supabaseHelpers.database.getSubjects();
      this.populateSubjectDropdown(subjects || []);
    } catch (error) {
      console.error('Error loading teacher data:', error);
    }
  }

  async loadStudentData() {
    try {
      // Load online lectures
      const { data: onlineLectures } = await supabaseHelpers.database.getLectures();
      
      // Load offline lectures
      const offlineLectures = await this.db.lectures.toArray();
      
      this.renderStudentLectures([...(onlineLectures || []), ...offlineLectures]);
      
      // Load assignments
      const { data: assignments } = await supabaseHelpers.database.getAssignments();
      this.renderStudentAssignments(assignments || []);
      
      // Load progress
      this.loadStudentProgress();
    } catch (error) {
      console.error('Error loading student data:', error);
    }
  }

  async loadAdminData() {
    try {
      const { data: subjects } = await supabaseHelpers.database.getSubjects();
      this.renderAdminSubjects(subjects || []);
      
      // Load system stats
      this.loadSystemStats();
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.recordedChunks = [];
      this.slideEvents = [];
      this.recordingStartTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;

      document.getElementById('start-recording').classList.add('hidden');
      document.getElementById('stop-recording').classList.remove('hidden');
      document.getElementById('slide-controls').classList.remove('hidden');

      this.startRecordingTimer();
      this.showNotification('Recording started', 'success');
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showNotification('Failed to start recording', 'error');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;

      document.getElementById('start-recording').classList.remove('hidden');
      document.getElementById('stop-recording').classList.add('hidden');
      document.getElementById('slide-controls').classList.add('hidden');

      this.stopRecordingTimer();
      this.showNotification('Recording stopped', 'success');
    }
  }

  startRecordingTimer() {
    const timerElement = document.getElementById('recording-time');
    
    this.recordingTimer = setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  stopRecordingTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.updateSlideDisplay();
      this.recordSlideEvent('previous');
    }
  }

  nextSlide() {
    if (this.currentSlideIndex < this.slides.length - 1) {
      this.currentSlideIndex++;
      this.updateSlideDisplay();
      this.recordSlideEvent('next');
    }
  }

  addAnnotation() {
    const annotation = prompt('Enter annotation:');
    if (annotation) {
      this.recordSlideEvent('annotate', { text: annotation });
      this.showNotification('Annotation added', 'success');
    }
  }

  recordSlideEvent(type, data = {}) {
    if (this.isRecording) {
      const timestamp = Date.now() - this.recordingStartTime;
      this.slideEvents.push({
        type,
        slideIndex: this.currentSlideIndex,
        timestamp,
        data
      });
    }
  }

  updateSlideDisplay() {
    const slideNumElement = document.getElementById('current-slide-num');
    slideNumElement.textContent = `${this.currentSlideIndex + 1} / ${this.slides.length}`;
  }

  handleSlidesUpload(files) {
    this.slides = Array.from(files);
    this.currentSlideIndex = 0;
    this.renderSlidesPreview();
    this.updateSlideDisplay();
  }

  renderSlidesPreview() {
    const container = document.getElementById('slides-preview');
    container.innerHTML = '';

    this.slides.forEach((file, index) => {
      const slideDiv = document.createElement('div');
      slideDiv.className = 'slide-thumbnail';
      
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = `Slide ${index + 1}`;
      
      const number = document.createElement('div');
      number.className = 'slide-number';
      number.textContent = index + 1;
      
      slideDiv.appendChild(img);
      slideDiv.appendChild(number);
      container.appendChild(slideDiv);
    });
  }

  addQuizQuestion() {
    const question = document.getElementById('quiz-question').value;
    const optionA = document.getElementById('option-a').value;
    const optionB = document.getElementById('option-b').value;
    const optionC = document.getElementById('option-c').value;
    const optionD = document.getElementById('option-d').value;
    const correct = document.getElementById('correct-answer').value;

    if (!question || !optionA || !optionB || !optionC || !optionD) {
      this.showNotification('Please fill all fields', 'warning');
      return;
    }

    const quiz = {
      id: Date.now(),
      question,
      options: { A: optionA, B: optionB, C: optionC, D: optionD },
      correct,
      slideIndex: this.currentSlideIndex
    };

    this.quizzes.push(quiz);
    this.renderQuizList();
    this.clearQuizForm();
    this.showNotification('Quiz question added', 'success');
  }

  renderQuizList() {
    const container = document.getElementById('quiz-list');
    container.innerHTML = '';

    this.quizzes.forEach((quiz, index) => {
      const quizDiv = document.createElement('div');
      quizDiv.className = 'quiz-item';
      
      quizDiv.innerHTML = `
        <div class="question">${quiz.question}</div>
        <div class="options">
          A: ${quiz.options.A}<br>
          B: ${quiz.options.B}<br>
          C: ${quiz.options.C}<br>
          D: ${quiz.options.D}<br>
          <strong>Correct: ${quiz.correct}</strong>
        </div>
        <button onclick="app.removeQuiz(${index})" class="secondary-btn">Remove</button>
      `;
      
      container.appendChild(quizDiv);
    });
  }

  removeQuiz(index) {
    this.quizzes.splice(index, 1);
    this.renderQuizList();
    this.showNotification('Quiz question removed', 'success');
  }

  clearQuizForm() {
    document.getElementById('quiz-question').value = '';
    document.getElementById('option-a').value = '';
    document.getElementById('option-b').value = '';
    document.getElementById('option-c').value = '';
    document.getElementById('option-d').value = '';
  }

  async buildLecturePackage() {
    if (!this.slides.length) {
      this.showNotification('Please upload slides first', 'warning');
      return;
    }

    try {
      const subject = document.getElementById('lecture-subject').value || 'General';
      const topic = document.getElementById('lecture-topic').value || 'Untitled';
      
      const zip = new JSZip();
      
      // Add metadata
      const metadata = {
        title: topic,
        subject,
        teacher: this.currentUser?.email || 'Unknown',
        created_at: new Date().toISOString(),
        slides: this.slides.map((file, index) => ({
          filename: `slide_${index + 1}.${file.name.split('.').pop()}`,
          originalName: file.name
        })),
        slideEvents: this.slideEvents,
        duration: this.recordedChunks.length > 0 ? Date.now() - this.recordingStartTime : 0
      };
      
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      
      // Add slides
      const slidesFolder = zip.folder('slides');
      for (let i = 0; i < this.slides.length; i++) {
        const file = this.slides[i];
        const filename = `slide_${i + 1}.${file.name.split('.').pop()}`;
        slidesFolder.file(filename, file);
      }
      
      // Add audio if recorded
      if (this.recordedChunks.length > 0) {
        const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        zip.file('audio.webm', audioBlob);
      }
      
      // Add quizzes
      if (this.quizzes.length > 0) {
        zip.file('quizzes.json', JSON.stringify(this.quizzes, null, 2));
      }
      
      // Generate ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      this.currentLectureZip = zipBlob;
      
      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const filename = `${subject}_${topic}_${new Date().toISOString().split('T')[0]}.zip`;
      
      const statusElement = document.getElementById('build-status');
      statusElement.innerHTML = `
        <div class="success">
          Lecture package built successfully!<br>
          <a href="${url}" download="${filename}" class="primary-btn">Download ZIP</a>
        </div>
      `;
      
      document.getElementById('upload-lecture').classList.remove('hidden');
      this.showNotification('Lecture package built successfully', 'success');
    } catch (error) {
      console.error('Error building lecture package:', error);
      this.showNotification('Failed to build lecture package', 'error');
    }
  }

  async uploadLecture() {
    if (!this.currentLectureZip) {
      this.showNotification('Please build lecture package first', 'warning');
      return;
    }

    try {
      const subject = document.getElementById('lecture-subject').value || 'General';
      const topic = document.getElementById('lecture-topic').value || 'Untitled';
      const filename = `${subject}_${topic}_${Date.now()}.zip`;
      
      // Upload to Supabase storage
      const { data, error } = await supabaseHelpers.storage.uploadLecture(
        this.currentLectureZip,
        filename
      );
      
      if (error) throw error;
      
      // Create database record
      const lectureData = {
        title: topic,
        subject,
        teacher_id: this.currentUser.id,
        file_path: filename,
        file_size: this.currentLectureZip.size,
        created_at: new Date().toISOString()
      };
      
      const { data: lecture, error: dbError } = await supabaseHelpers.database.createLecture(lectureData);
      
      if (dbError) throw dbError;
      
      this.showNotification('Lecture uploaded successfully', 'success');
      this.resetLectureForm();
      this.loadTeacherData();
    } catch (error) {
      console.error('Error uploading lecture:', error);
      this.showNotification('Failed to upload lecture', 'error');
    }
  }

  resetLectureForm() {
    document.getElementById('lecture-subject').value = '';
    document.getElementById('lecture-topic').value = '';
    document.getElementById('slides-input').value = '';
    document.getElementById('slides-preview').innerHTML = '';
    document.getElementById('build-status').innerHTML = '';
    document.getElementById('upload-lecture').classList.add('hidden');
    
    this.slides = [];
    this.quizzes = [];
    this.slideEvents = [];
    this.recordedChunks = [];
    this.currentLectureZip = null;
    
    this.renderQuizList();
  }

  async importLectureZip(file) {
    if (!file) return;

    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      
      // Read metadata
      const metadataFile = content.file('metadata.json');
      if (!metadataFile) {
        throw new Error('Invalid lecture package: missing metadata');
      }
      
      const metadata = JSON.parse(await metadataFile.async('string'));
      
      // Store in IndexedDB for offline access
      const lectureData = {
        title: metadata.title,
        subject: metadata.subject,
        teacher: metadata.teacher,
        file_path: file.name,
        metadata,
        downloaded_at: new Date().toISOString()
      };
      
      await this.db.lectures.add(lectureData);
      
      // Store ZIP file in IndexedDB
      await this.storeZipFile(file.name, file);
      
      this.showNotification('Lecture imported successfully', 'success');
      this.loadStudentData();
    } catch (error) {
      console.error('Error importing lecture:', error);
      this.showNotification('Failed to import lecture', 'error');
    }
  }

  async storeZipFile(filename, file) {
    // Store file in IndexedDB using a separate store
    if (!this.db.files) {
      this.db.version(2).stores({
        lectures: '++id, title, subject, teacher_id, file_path, downloaded_at',
        assignments: '++id, title, subject, teacher_id, due_date, submitted',
        quiz_responses: '++id, lecture_id, question_id, answer, timestamp',
        sync_queue: '++id, type, data, timestamp, retries',
        files: '++id, filename, data, stored_at'
      });
      await this.db.open();
    }
    
    await this.db.files.add({
      filename,
      data: file,
      stored_at: new Date().toISOString()
    });
  }

  async playLecture(lectureId) {
    try {
      let lectureData;
      let zipFile;
      
      // Try to get from IndexedDB first (offline)
      lectureData = await this.db.lectures.get(lectureId);
      
      if (lectureData) {
        // Get ZIP file from IndexedDB
        const fileRecord = await this.db.files.where('filename').equals(lectureData.file_path).first();
        if (fileRecord) {
          zipFile = fileRecord.data;
        }
      } else {
        // Get from Supabase (online)
        const { data, error } = await supabaseHelpers.database.getLectures({ id: lectureId });
        if (error) throw error;
        
        lectureData = data[0];
        
        // Download ZIP file
        const { data: zipData, error: downloadError } = await supabaseHelpers.storage.downloadLecture(lectureData.file_path);
        if (downloadError) throw downloadError;
        
        zipFile = zipData;
      }
      
      await this.loadLecturePlayer(lectureData, zipFile);
    } catch (error) {
      console.error('Error playing lecture:', error);
      this.showNotification('Failed to load lecture', 'error');
    }
  }

  async loadLecturePlayer(lectureData, zipFile) {
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(zipFile);
      
      // Read metadata
      const metadata = JSON.parse(await content.file('metadata.json').async('string'));
      
      // Load slides
      const slides = [];
      const slidesFolder = content.folder('slides');
      
      for (const slide of metadata.slides) {
        const slideFile = slidesFolder.file(slide.filename);
        if (slideFile) {
          const blob = await slideFile.async('blob');
          slides.push(URL.createObjectURL(blob));
        }
      }
      
      // Load audio
      let audioUrl = null;
      const audioFile = content.file('audio.webm');
      if (audioFile) {
        const audioBlob = await audioFile.async('blob');
        audioUrl = URL.createObjectURL(audioBlob);
      }
      
      // Load quizzes
      let quizzes = [];
      const quizzesFile = content.file('quizzes.json');
      if (quizzesFile) {
        quizzes = JSON.parse(await quizzesFile.async('string'));
      }
      
      this.currentLecture = {
        data: lectureData,
        metadata,
        slides,
        audioUrl,
        quizzes,
        slideEvents: metadata.slideEvents || []
      };
      
      this.showLecturePlayer();
    } catch (error) {
      console.error('Error loading lecture player:', error);
      this.showNotification('Failed to load lecture player', 'error');
    }
  }

  showLecturePlayer() {
    this.showScreen('lecture-player');
    
    // Set title and info
    document.getElementById('player-title').textContent = this.currentLecture.data.title;
    document.getElementById('player-info').textContent = 
      `${this.currentLecture.data.subject} • ${this.currentLecture.data.teacher}`;
    
    // Load first slide
    this.currentSlideIndex = 0;
    this.updatePlayerSlide();
    
    // Setup audio
    if (this.currentLecture.audioUrl) {
      this.audioElement = document.getElementById('lecture-audio');
      this.audioElement.src = this.currentLecture.audioUrl;
      this.setupAudioSync();
    }
    
    // Setup close button
    document.getElementById('close-player').onclick = () => {
      this.closeLecturePlayer();
    };
  }

  updatePlayerSlide() {
    const slideImg = document.getElementById('current-slide');
    const slideCounter = document.getElementById('slide-counter');
    
    if (this.currentLecture.slides[this.currentSlideIndex]) {
      slideImg.src = this.currentLecture.slides[this.currentSlideIndex];
      slideCounter.textContent = `${this.currentSlideIndex + 1} / ${this.currentLecture.slides.length}`;
    }
  }

  setupAudioSync() {
    if (!this.audioElement) return;
    
    this.audioElement.addEventListener('timeupdate', () => {
      this.syncSlideToAudio();
      this.updateProgressBar();
    });
    
    this.audioElement.addEventListener('loadedmetadata', () => {
      document.getElementById('total-time').textContent = this.formatTime(this.audioElement.duration);
    });
  }

  syncSlideToAudio() {
    if (!this.currentLecture.slideEvents.length) return;
    
    const currentTime = this.audioElement.currentTime * 1000; // Convert to milliseconds
    
    // Find the appropriate slide based on slide events
    let targetSlideIndex = 0;
    for (const event of this.currentLecture.slideEvents) {
      if (event.timestamp <= currentTime && event.type === 'next') {
        targetSlideIndex = event.slideIndex;
      }
    }
    
    if (targetSlideIndex !== this.currentSlideIndex) {
      this.currentSlideIndex = targetSlideIndex;
      this.updatePlayerSlide();
    }
  }

  updateProgressBar() {
    if (!this.audioElement) return;
    
    const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('current-time').textContent = this.formatTime(this.audioElement.currentTime);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  togglePlayback() {
    if (!this.audioElement) return;
    
    if (this.audioElement.paused) {
      this.audioElement.play();
      document.getElementById('player-play').textContent = '⏸️';
    } else {
      this.audioElement.pause();
      document.getElementById('player-play').textContent = '▶️';
    }
  }

  playerPreviousSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.updatePlayerSlide();
      
      // Seek audio to slide timestamp if available
      if (this.audioElement && this.currentLecture.slideEvents.length > 0) {
        const slideEvent = this.currentLecture.slideEvents.find(
          event => event.slideIndex === this.currentSlideIndex && event.type === 'next'
        );
        if (slideEvent) {
          this.audioElement.currentTime = slideEvent.timestamp / 1000;
        }
      }
    }
  }

  playerNextSlide() {
    if (this.currentSlideIndex < this.currentLecture.slides.length - 1) {
      this.currentSlideIndex++;
      this.updatePlayerSlide();
      
      // Seek audio to slide timestamp if available
      if (this.audioElement && this.currentLecture.slideEvents.length > 0) {
        const slideEvent = this.currentLecture.slideEvents.find(
          event => event.slideIndex === this.currentSlideIndex && event.type === 'next'
        );
        if (slideEvent) {
          this.audioElement.currentTime = slideEvent.timestamp / 1000;
        }
      }
    }
  }

  closeLecturePlayer() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }
    
    // Clean up object URLs
    if (this.currentLecture) {
      this.currentLecture.slides.forEach(url => URL.revokeObjectURL(url));
      if (this.currentLecture.audioUrl) {
        URL.revokeObjectURL(this.currentLecture.audioUrl);
      }
    }
    
    this.currentLecture = null;
    this.showDashboard();
  }

  // Live Class functionality
  async startLiveClass() {
    try {
      if (!this.slides.length) {
        this.showNotification('Please upload slides first', 'warning');
        return;
      }
      
      const classId = `live_${Date.now()}`;
      
      // Subscribe to live class channel
      this.liveClassSubscription = supabaseHelpers.realtime.subscribeToLiveClass(
        classId,
        (payload) => this.handleLiveClassEvent(payload)
      );
      
      // Broadcast class start
      await supabaseHelpers.realtime.broadcastClassStart(classId, {
        title: document.getElementById('lecture-topic').value || 'Live Class',
        subject: document.getElementById('lecture-subject').value || 'General',
        teacher: this.currentUser.email
      });
      
      document.getElementById('start-live').classList.add('hidden');
      document.getElementById('end-live').classList.remove('hidden');
      document.getElementById('live-status').textContent = 'Live';
      document.getElementById('live-participants').classList.remove('hidden');
      document.getElementById('live-slides').classList.remove('hidden');
      
      this.showNotification('Live class started', 'success');
    } catch (error) {
      console.error('Error starting live class:', error);
      this.showNotification('Failed to start live class', 'error');
    }
  }

  async endLiveClass() {
    try {
      if (this.liveClassSubscription) {
        await supabaseHelpers.realtime.broadcastClassEnd(this.liveClassSubscription.topic);
        supabaseHelpers.realtime.unsubscribe(this.liveClassSubscription);
        this.liveClassSubscription = null;
      }
      
      document.getElementById('start-live').classList.remove('hidden');
      document.getElementById('end-live').classList.add('hidden');
      document.getElementById('live-status').textContent = 'Not Live';
      document.getElementById('live-participants').classList.add('hidden');
      document.getElementById('live-slides').classList.add('hidden');
      
      this.showNotification('Live class ended', 'success');
    } catch (error) {
      console.error('Error ending live class:', error);
      this.showNotification('Failed to end live class', 'error');
    }
  }

  handleLiveClassEvent(payload) {
    switch (payload.event) {
      case 'slide_change':
        this.currentSlideIndex = payload.payload.slideIndex;
        this.updateLiveSlideDisplay();
        break;
      case 'class_start':
        this.showNotification('Live class started', 'info');
        break;
      case 'class_end':
        this.showNotification('Live class ended', 'info');
        break;
    }
  }

  updateLiveSlideDisplay() {
    const slideDisplay = document.getElementById('live-slide-display');
    const slideNum = document.getElementById('live-slide-num');
    
    if (this.slides[this.currentSlideIndex]) {
      slideDisplay.innerHTML = `<img src="${URL.createObjectURL(this.slides[this.currentSlideIndex])}" alt="Live Slide">`;
      slideNum.textContent = `${this.currentSlideIndex + 1} / ${this.slides.length}`;
    }
  }

  // Utility functions
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
  }

  showTab(contentId, tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Show selected content and activate tab
    document.getElementById(contentId).classList.remove('hidden');
    document.getElementById(tabId).classList.add('active');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.getElementById('notifications').appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
    
    // Remove on click
    notification.addEventListener('click', () => {
      notification.remove();
    });
  }

  async logout() {
    try {
      await supabaseHelpers.auth.signOut();
      this.currentUser = null;
      
      // Clean up subscriptions
      if (this.liveClassSubscription) {
        supabaseHelpers.realtime.unsubscribe(this.liveClassSubscription);
        this.liveClassSubscription = null;
      }
      
      if (this.notificationSubscription) {
        supabaseHelpers.realtime.unsubscribe(this.notificationSubscription);
        this.notificationSubscription = null;
      }
      
      this.showScreen('login-screen');
      this.showNotification('Logged out successfully', 'success');
    } catch (error) {
      console.error('Error logging out:', error);
      this.showNotification('Failed to logout', 'error');
    }
  }

  enterOfflineMode() {
    this.showScreen('student-screen');
    this.loadStudentData();
    this.showNotification('Entered offline mode', 'info');
  }

  // Connection and storage monitoring
  startConnectionMonitoring() {
    const updateStatus = () => {
      const statusElement = document.getElementById('connection-status');
      if (navigator.onLine) {
        statusElement.textContent = 'Online';
        statusElement.className = 'status online';
      } else {
        statusElement.textContent = 'Offline';
        statusElement.className = 'status offline';
      }
    };
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  async startStorageMonitoring() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const updateStorage = async () => {
        try {
          const estimate = await navigator.storage.estimate();
          const used = estimate.usage || 0;
          const quota = estimate.quota || 0;
          
          const usedMB = Math.round(used / 1024 / 1024);
          const quotaMB = Math.round(quota / 1024 / 1024);
          
          document.getElementById('storage-status').textContent = 
            `Storage: ${usedMB}MB / ${quotaMB}MB`;
        } catch (error) {
          console.error('Error getting storage estimate:', error);
        }
      };
      
      updateStorage();
      setInterval(updateStorage, 30000); // Update every 30 seconds
    }
  }

  // Auto-sync scheduling
  scheduleAutoSync() {
    // Schedule sync for 2 AM daily
    const now = new Date();
    const syncTime = new Date();
    syncTime.setHours(2, 0, 0, 0);
    
    if (syncTime <= now) {
      syncTime.setDate(syncTime.getDate() + 1);
    }
    
    const timeUntilSync = syncTime.getTime() - now.getTime();
    
    setTimeout(() => {
      this.performAutoSync();
      // Schedule next sync
      setInterval(() => {
        this.performAutoSync();
      }, 24 * 60 * 60 * 1000); // Every 24 hours
    }, timeUntilSync);
  }

  async performAutoSync() {
    if (!navigator.onLine) return;
    
    try {
      // Upload pending items from sync queue
      const pendingItems = await this.db.sync_queue.toArray();
      
      for (const item of pendingItems) {
        try {
          await this.processSyncItem(item);
          await this.db.sync_queue.delete(item.id);
        } catch (error) {
          console.error('Error syncing item:', error);
          // Increment retry count
          await this.db.sync_queue.update(item.id, {
            retries: (item.retries || 0) + 1
          });
        }
      }
      
      // Download new lectures
      await this.downloadNewLectures();
      
      this.showNotification('Auto-sync completed', 'success');
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }

  async processSyncItem(item) {
    switch (item.type) {
      case 'quiz_response':
        await supabaseHelpers.database.submitQuizResponse(item.data);
        break;
      case 'assignment_submission':
        await supabaseHelpers.database.submitAssignment(item.data);
        break;
      // Add more sync types as needed
    }
  }

  async downloadNewLectures() {
    try {
      const { data: onlineLectures } = await supabaseHelpers.database.getLectures();
      const offlineLectures = await this.db.lectures.toArray();
      
      const newLectures = onlineLectures.filter(online => 
        !offlineLectures.some(offline => offline.id === online.id)
      );
      
      for (const lecture of newLectures) {
        try {
          const { data: zipData } = await supabaseHelpers.storage.downloadLecture(lecture.file_path);
          
          await this.db.lectures.add({
            ...lecture,
            downloaded_at: new Date().toISOString()
          });
          
          await this.storeZipFile(lecture.file_path, zipData);
        } catch (error) {
          console.error('Error downloading lecture:', lecture.title, error);
        }
      }
    } catch (error) {
      console.error('Error downloading new lectures:', error);
    }
  }

  setupNotifications() {
    if (this.currentUser && !this.notificationSubscription) {
      this.notificationSubscription = supabaseHelpers.notifications.subscribeToNotifications(
        this.currentUser.id,
        (payload) => {
          const notification = payload.new;
          this.showNotification(notification.message, notification.type);
        }
      );
    }
  }

  // Render functions
  renderTeacherLectures(lectures) {
    const container = document.getElementById('teacher-lectures');
    container.innerHTML = '';
    
    lectures.forEach(lecture => {
      const lectureDiv = document.createElement('div');
      lectureDiv.className = 'lecture-card';
      lectureDiv.innerHTML = `
        <h3>${lecture.title}</h3>
        <div class="meta">${lecture.subject} • ${new Date(lecture.created_at).toLocaleDateString()}</div>
        <div class="actions">
          <button onclick="app.editLecture(${lecture.id})" class="secondary-btn">Edit</button>
          <button onclick="app.deleteLecture(${lecture.id})" class="secondary-btn">Delete</button>
        </div>
      `;
      container.appendChild(lectureDiv);
    });
  }

  renderStudentLectures(lectures) {
    const container = document.getElementById('available-lectures');
    container.innerHTML = '';
    
    lectures.forEach(lecture => {
      const lectureDiv = document.createElement('div');
      lectureDiv.className = 'lecture-card';
      lectureDiv.onclick = () => this.playLecture(lecture.id);
      
      const status = lecture.downloaded_at ? 'downloaded' : 'not-downloaded';
      
      lectureDiv.innerHTML = `
        <h3>${lecture.title}</h3>
        <div class="meta">${lecture.subject} • ${lecture.teacher || lecture.profiles?.email}</div>
        <div class="status ${status}">
          ${lecture.downloaded_at ? 'Downloaded' : 'Online Only'}
        </div>
      `;
      container.appendChild(lectureDiv);
    });
  }

  renderStudentAssignments(assignments) {
    const container = document.getElementById('assignments-grid');
    container.innerHTML = '';
    
    assignments.forEach(assignment => {
      const assignmentDiv = document.createElement('div');
      assignmentDiv.className = 'assignment-card';
      
      const dueDate = new Date(assignment.due_date);
      const isOverdue = dueDate < new Date();
      
      assignmentDiv.innerHTML = `
        <h3>${assignment.title}</h3>
        <div class="meta">${assignment.subject} • Due: ${dueDate.toLocaleDateString()}</div>
        <div class="status ${isOverdue ? 'overdue' : 'pending'}">
          ${isOverdue ? 'Overdue' : 'Pending'}
        </div>
        <button onclick="app.openAssignment(${assignment.id})" class="primary-btn">
          ${assignment.submitted ? 'View Submission' : 'Submit'}
        </button>
      `;
      container.appendChild(assignmentDiv);
    });
  }

  renderAdminSubjects(subjects) {
    const container = document.getElementById('subjects-list');
    container.innerHTML = '';
    
    subjects.forEach(subject => {
      const subjectDiv = document.createElement('div');
      subjectDiv.innerHTML = `
        <div class="subject-item">
          <span>${subject.name}</span>
          <button onclick="app.deleteSubject(${subject.id})" class="secondary-btn">Delete</button>
        </div>
      `;
      container.appendChild(subjectDiv);
    });
  }

  async loadStudentProgress() {
    // Load quiz scores, attendance, etc.
    // This would integrate with the database to show student progress
    const progressElement = document.getElementById('overall-progress');
    const percentageElement = document.getElementById('overall-percentage');
    
    // Mock progress for now
    const progress = 75;
    progressElement.style.width = `${progress}%`;
    percentageElement.textContent = `${progress}%`;
  }

  async loadSystemStats() {
    // Load system statistics for admin
    try {
      const { data: lectures } = await supabaseHelpers.database.getLectures();
      document.getElementById('total-lectures').textContent = lectures?.length || 0;
      
      // Add more stats as needed
    } catch (error) {
      console.error('Error loading system stats:', error);
    }
  }

  showLanguageModal() {
    document.getElementById('language-modal').classList.remove('hidden');
    
    document.querySelectorAll('.lang-option').forEach(option => {
      option.onclick = () => {
        this.changeLanguage(option.dataset.lang);
        document.getElementById('language-modal').classList.add('hidden');
      };
    });
  }

  changeLanguage(lang) {
    this.currentLanguage = lang;
    localStorage.setItem('liteclass_language', lang);
    
    // Update UI text based on selected language
    // This would be expanded to translate all UI elements
    this.showNotification(`Language changed to ${lang === 'en' ? 'English' : 'हिंदी'}`, 'success');
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new LiteClassApp();
});