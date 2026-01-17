
// Separate type and value imports to resolve potential parser issues in specific TypeScript environments
import { initializeApp, getApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  query,
  where,
  updateDoc,
  arrayUnion,
  getDoc,
  type Firestore
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  type Auth
} from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from "firebase/storage";
import { Task, User, Team } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

class FirebaseInit {
  private static app: FirebaseApp | null = null;

  static getAppInstance(): FirebaseApp | null {
    if (!isConfigValid) return null;
    if (!this.app) {
      try {
        const apps = getApps();
        this.app = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
      } catch (error) {
        console.error("Firebase Initialization Error:", error);
      }
    }
    return this.app;
  }

  static getAuthInstance(): Auth | null {
    const app = this.getAppInstance();
    return app ? getAuth(app) : null;
  }

  static getDbInstance(): Firestore | null {
    const app = this.getAppInstance();
    return app ? getFirestore(app) : null;
  }

  static getStorageInstance(): FirebaseStorage | null {
    const app = this.getAppInstance();
    return app ? getStorage(app) : null;
  }
}

const googleProvider = new GoogleAuthProvider();

export class FirebaseService {
  private storageKey = "tasksetu_tasks_db";
  private userKey = "tasksetu_user_local";

  // AUTH METHODS
  async signInWithGoogle(): Promise<User> {
    const auth = FirebaseInit.getAuthInstance();
    if (!auth) {
      console.warn("Firebase Auth not available. Using demo mode.");
      const demoUser: User = {
        id: "demo-user",
        name: "Arjun Mehta (Demo)",
        email: "demo@tasksetu.in",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun",
      };
      localStorage.setItem(this.userKey, JSON.stringify(demoUser));
      return demoUser;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      return this.mapFirebaseUser(result.user);
    } catch (error: any) {
      console.error("Sign-in error:", error);
      if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/popup-blocked') {
        throw new Error(`Auth Failed: ${error.message}. Try "Guest Mode" if available.`);
      }
      throw error;
    }
  }

  async signInAsGuest(): Promise<User> {
    const guestUser: User = {
      id: "guest-" + Math.random().toString(36).substr(2, 5),
      name: "Guest User",
      email: "guest@tasksetu.in",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
    };
    localStorage.setItem(this.userKey, JSON.stringify(guestUser));
    return guestUser;
  }

  async signOutUser(): Promise<void> {
    const auth = FirebaseInit.getAuthInstance();
    if (auth) await signOut(auth);
    localStorage.removeItem(this.userKey);
  }

  onAuthChange(callback: (user: User | null) => void) {
    const auth = FirebaseInit.getAuthInstance();
    if (!auth) {
      const localUser = localStorage.getItem(this.userKey);
      const timeout = setTimeout(() => callback(localUser ? JSON.parse(localUser) : null), 100);
      return () => clearTimeout(timeout);
    }
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const user = this.mapFirebaseUser(fbUser);
        // Sync user profile to Firestore so others can find them
        const db = FirebaseInit.getDbInstance();
        if (db) {
          try {
            await setDoc(doc(db, "users", user.id), user, { merge: true });
          } catch (e) { console.error("Error syncing user profile:", e); }
        }
        callback(user);
      } else {
        const localUser = localStorage.getItem(this.userKey);
        callback(localUser ? JSON.parse(localUser) : null);
      }
    });
  }

  async syncUserProfile(user: User): Promise<void> {
    const db = FirebaseInit.getDbInstance();
    if (!db) return;
    try {
      console.log("Services: Syncing user profile:", user.id);
      await setDoc(doc(db, "users", user.id), user, { merge: true });
      console.log("Services: Profile synced.");
    } catch (e: any) {
      console.error("Error syncing user profile:", e);
      alert("Database Error: " + (e.message || "Could not save user profile. Check console."));
    }
  }

  async getUsersByIds(userIds: string[]): Promise<User[]> {
    const db = FirebaseInit.getDbInstance();
    if (!db || userIds.length === 0) return [];

    // Firestore 'in' query supports max 10 values.
    // For larger sets, we'd need to batch, but for now we'll slice or just do parallel gets if needed.
    // Let's implement robust parallel ID fetching which is safer than 'in' query for variable list sizes.
    try {
      const uniqueIds = Array.from(new Set(userIds));
      console.log("Services: Fetching Users for IDs:", uniqueIds);
      const userPromises = uniqueIds.map(id => getDoc(doc(db, "users", id)));
      const snapshots = await Promise.all(userPromises);

      const foundUsers = snapshots
        .filter(snap => snap.exists())
        .map(snap => snap.data() as User);

      console.log("Services: Found Users:", foundUsers);
      return foundUsers;
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  }

  private mapFirebaseUser(fbUser: FirebaseUser): User {
    return {
      id: fbUser.uid,
      name: fbUser.displayName || "User",
      email: fbUser.email || "",
      avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
      phoneNumber: fbUser.phoneNumber || null
    };
  }

  // FIRESTORE METHODS
  async getTasks(): Promise<Task[]> {
    const db = FirebaseInit.getDbInstance();
    if (!db) {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    }
    try {
      const tasksCol = collection(db, 'tasks');
      const taskSnapshot = await getDocs(tasksCol);
      return taskSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Task));
    } catch (error) {
      console.error("Firestore error, falling back to local storage:", error);
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    }
  }

  async saveTask(task: Task): Promise<void> {
    const db = FirebaseInit.getDbInstance();
    const tasks = await this.getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    const updatedTasks = index > -1
      ? tasks.map((t, i) => i === index ? task : t)
      : [task, ...tasks];

    localStorage.setItem(this.storageKey, JSON.stringify(updatedTasks));

    if (db) {
      try {
        await setDoc(doc(db, "tasks", task.id), task);
      } catch (error) {
        console.error("Error saving to Firestore:", error);
      }
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const db = FirebaseInit.getDbInstance();
    const tasks = await this.getTasks();
    localStorage.setItem(this.storageKey, JSON.stringify(tasks.filter(t => t.id !== taskId)));

    if (db) {
      try {
        await deleteDoc(doc(db, "tasks", taskId));
      } catch (error) {
        console.error("Error deleting from Firestore:", error);
      }
    }
  }

  async uploadFile(file: File): Promise<string> {
    const storage = FirebaseInit.getStorageInstance();
    if (!storage) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
    // Check for localhost/dev environment to avoid CORS errors
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log("Localhost detected: Skipping cloud upload (CORS avoidance). Using local preview.");
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    try {
      const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.warn("Storage upload failed (CORS/Auth). Falling back to Base64:", error);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  }
  // TEAM METHODS
  async getTeams(userId: string): Promise<Team[]> {
    const db = FirebaseInit.getDbInstance();
    if (!db) {
      // Fallback to local storage or mocked data if needed, but primarily relying on DB
      return [];
    }

    try {
      const teamsRef = collection(db, "teams");
      // Query teams where the user is in the 'members' array
      const q = query(teamsRef, where("members", "array-contains", userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
    } catch (error) {
      console.error("Error fetching teams:", error);
      return [];
    }
  }

  async saveTeam(team: Team): Promise<void> {
    const db = FirebaseInit.getDbInstance();
    if (!db) return;

    try {
      await setDoc(doc(db, "teams", team.id), team);
    } catch (error) {
      console.error("Error saving team:", error);
      throw error;
    }
  }

  async joinTeamByCode(code: string, userId: string): Promise<Team> {
    const db = FirebaseInit.getDbInstance();
    if (!db) throw new Error("Database not connected");

    try {
      const teamsRef = collection(db, "teams");
      const q = query(teamsRef, where("joinCode", "==", code));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error("Invalid joining code");
      }

      const teamDoc = snapshot.docs[0];
      const teamData = teamDoc.data() as Team;

      // Check if already a member
      if (teamData.members.includes(userId)) {
        return { id: teamDoc.id, ...teamData };
      }

      // Check usage limits
      const currentUsage = teamData.joinCodeUsage || 0;
      if (currentUsage >= 3) {
        throw new Error("This join code has expired (used 3 times). Please ask the admin to regenerate it.");
      }

      // Add user to team and increment usage
      await updateDoc(doc(db, "teams", teamDoc.id), {
        members: arrayUnion(userId),
        joinCodeUsage: currentUsage + 1
      });

      return {
        id: teamDoc.id,
        ...teamData,
        members: [...teamData.members, userId],
        joinCodeUsage: currentUsage + 1
      };
    } catch (error) {
      console.error("Error joining team:", error);
      throw error;
    }
  }
}

export const firebaseService = new FirebaseService();
