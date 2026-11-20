import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  CoachingInfo,
  GalleryItem,
  LearningResource,
  SiteData,
  SocialLinks,
  TeacherProfile,
} from '../types/coaching';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInAdminWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutFirebaseAdmin(): Promise<void> {
  await signOut(auth);
}

function toIsoString(value: unknown, fallback = new Date().toISOString()): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallback;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export async function loadPublicSiteFromFirestore(): Promise<Partial<SiteData>> {
  const result: Partial<SiteData> = {};

  try {
    const [coachingSnap, socialSnap, teacherSnap] = await Promise.all([
      getDoc(doc(db, 'coachingConfig', 'main')),
      getDoc(doc(db, 'socialLinksConfig', 'main')),
      getDoc(doc(db, 'teacherConfig', 'main')),
    ]);

    if (coachingSnap.exists()) {
      const data = coachingSnap.data();
      result.coaching = {
        name: String(data.name || ''),
        tagline: String(data.tagline || ''),
        welcomeHeadline: String(data.welcomeHeadline || ''),
        welcomeSubtitle: String(data.welcomeSubtitle || ''),
        aboutHeading: String(data.aboutHeading || ''),
        aboutDescription: String(data.aboutDescription || ''),
        classesRangeText: String(data.classesRangeText || ''),
        address: String(data.address || ''),
        googleMapsUrl: String(data.googleMapsUrl || ''),
        phone: String(data.phone || ''),
        email: String(data.email || ''),
        officeHours: String(data.officeHours || ''),
        heroMediaUrl: typeof data.heroMediaUrl === 'string' ? data.heroMediaUrl : '',
        heroMediaType: data.heroMediaType === 'video' ? 'video' : 'image',
      };
    }

    if (socialSnap.exists()) {
      const data = socialSnap.data();
      result.socialLinks = {
        whatsapp: String(data.whatsapp || ''),
        instagram: String(data.instagram || ''),
        facebook: String(data.facebook || ''),
        youtube: String(data.youtube || ''),
      };
    }

    if (teacherSnap.exists()) {
      const data = teacherSnap.data();
      result.teacher = {
        name: String(data.name || ''),
        roleTitle: String(data.roleTitle || ''),
        photoUrl: String(data.photoUrl || ''),
        introduction: String(data.introduction || ''),
        qualifications: String(data.qualifications || ''),
        experience: String(data.experience || ''),
        skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
        classesTaught: String(data.classesTaught || ''),
        subjectsTaught: Array.isArray(data.subjectsTaught)
          ? data.subjectsTaught.map(String)
          : [],
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'coachingConfig/main');
  }

  try {
    const galQuery = query(
      collection(db, 'galleryItems'),
      where('published', '==', true),
    );
    const galSnap = await getDocs(galQuery);
    if (!galSnap.empty) {
      result.gallery = galSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            title: String(data.title || ''),
            caption: String(data.caption || ''),
            category: data.category as GalleryItem['category'],
            mediaType: data.mediaType as GalleryItem['mediaType'],
            mediaUrl: String(data.mediaUrl || ''),
            thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
            published: Boolean(data.published),
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'galleryItems');
  }

  try {
    const hubQuery = query(
      collection(db, 'learningHubItems'),
      where('published', '==', true),
    );
    const hubSnap = await getDocs(hubQuery);
    if (!hubSnap.empty) {
      result.learningHub = hubSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            title: String(data.title || ''),
            topicArea: String(data.topicArea || ''),
            summary: String(data.summary || ''),
            content: String(data.content || ''),
            languageNote: String(data.languageNote || 'Hindi + English Bilingual'),
            keyFormulas: Array.isArray(data.keyFormulas)
              ? data.keyFormulas.map(String)
              : [],
            pdfUrl: typeof data.pdfUrl === 'string' ? data.pdfUrl : undefined,
            pdfName: typeof data.pdfName === 'string' ? data.pdfName : undefined,
            published: Boolean(data.published),
            updatedAt: toIsoString(data.updatedAt),
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'learningHubItems');
  }

  return result;
}

export async function loadAllAdminSiteDataFromFirestore(): Promise<Partial<SiteData>> {
  const result = await loadPublicSiteFromFirestore();
  try {
    const galSnap = await getDocs(collection(db, 'galleryItems'));
    if (!galSnap.empty) {
      result.gallery = galSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            title: String(data.title || ''),
            caption: String(data.caption || ''),
            category: data.category as GalleryItem['category'],
            mediaType: data.mediaType as GalleryItem['mediaType'],
            mediaUrl: String(data.mediaUrl || ''),
            thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
            published: Boolean(data.published),
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'galleryItems');
  }

  try {
    const hubSnap = await getDocs(collection(db, 'learningHubItems'));
    if (!hubSnap.empty) {
      result.learningHub = hubSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            title: String(data.title || ''),
            topicArea: String(data.topicArea || ''),
            summary: String(data.summary || ''),
            content: String(data.content || ''),
            languageNote: String(data.languageNote || 'Hindi + English Bilingual'),
            keyFormulas: Array.isArray(data.keyFormulas)
              ? data.keyFormulas.map(String)
              : [],
            pdfUrl: typeof data.pdfUrl === 'string' ? data.pdfUrl : undefined,
            pdfName: typeof data.pdfName === 'string' ? data.pdfName : undefined,
            published: Boolean(data.published),
            updatedAt: toIsoString(data.updatedAt),
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'learningHubItems');
  }

  return result;
}

export async function saveCoachingAndSocialsToCloud(
  coaching: CoachingInfo,
  socialLinks: SocialLinks,
): Promise<void> {
  if (!auth.currentUser) return;

  try {
    await setDoc(
      doc(db, 'coachingConfig', 'main'),
      stripUndefined({
        name: coaching.name.slice(0, 120),
        tagline: coaching.tagline.slice(0, 200),
        welcomeHeadline: (coaching.welcomeHeadline || '').slice(0, 240),
        welcomeSubtitle: (coaching.welcomeSubtitle || '').slice(0, 600),
        aboutHeading: (coaching.aboutHeading || '').slice(0, 200),
        aboutDescription: (coaching.aboutDescription || '').slice(0, 3000),
        classesRangeText: (coaching.classesRangeText || '').slice(0, 300),
        address: coaching.address.slice(0, 300),
        googleMapsUrl: coaching.googleMapsUrl.slice(0, 600),
        phone: (coaching.phone || '').slice(0, 80),
        email: (coaching.email || '').slice(0, 160),
        officeHours: (coaching.officeHours || '').slice(0, 160),
        heroMediaUrl: (coaching.heroMediaUrl || '').slice(0, 800000),
        heroMediaType: coaching.heroMediaType === 'video' ? 'video' : 'image',
        updatedAt: serverTimestamp(),
      }),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'coachingConfig/main');
  }

  try {
    await setDoc(doc(db, 'socialLinksConfig', 'main'), {
      whatsapp: socialLinks.whatsapp.slice(0, 500),
      instagram: socialLinks.instagram.slice(0, 500),
      facebook: socialLinks.facebook.slice(0, 500),
      youtube: socialLinks.youtube.slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'socialLinksConfig/main');
  }
}

export async function saveTeacherToCloud(teacher: TeacherProfile): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await setDoc(
      doc(db, 'teacherConfig', 'main'),
      stripUndefined({
        name: teacher.name.slice(0, 160),
        roleTitle: (teacher.roleTitle || '').slice(0, 200),
        photoUrl: (teacher.photoUrl || '').slice(0, 800000),
        introduction: teacher.introduction.slice(0, 3000),
        qualifications: teacher.qualifications.slice(0, 400),
        experience: teacher.experience.slice(0, 400),
        skills: teacher.skills.slice(0, 25).map((s) => s.slice(0, 160)),
        classesTaught: teacher.classesTaught.slice(0, 200),
        subjectsTaught: teacher.subjectsTaught.slice(0, 25).map((s) => s.slice(0, 160)),
        updatedAt: serverTimestamp(),
      }),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'teacherConfig/main');
  }
}

export async function saveGalleryItemToCloud(item: GalleryItem): Promise<void> {
  if (!auth.currentUser) return;
  const ref = doc(db, 'galleryItems', item.id);
  try {
    const existing = await getDoc(ref);
    const createdAt = existing.exists()
      ? existing.data().createdAt
      : serverTimestamp();

    const payload: Record<string, unknown> = {
      id: item.id,
      title: item.title.slice(0, 200),
      caption: (item.caption || '').slice(0, 1000),
      category: item.category,
      mediaType: item.mediaType,
      mediaUrl: item.mediaUrl.slice(0, 800000),
      published: Boolean(item.published),
      createdAt,
      updatedAt: serverTimestamp(),
    };
    if (item.thumbnailUrl?.trim()) {
      payload.thumbnailUrl = item.thumbnailUrl.trim().slice(0, 800000);
    }

    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `galleryItems/${item.id}`);
  }
}

export async function deleteGalleryItemFromCloud(id: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'galleryItems', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `galleryItems/${id}`);
  }
}

export async function saveLearningResourceToCloud(resource: LearningResource): Promise<void> {
  if (!auth.currentUser) return;
  const ref = doc(db, 'learningHubItems', resource.id);
  try {
    const payload: Record<string, unknown> = {
      id: resource.id,
      title: resource.title.slice(0, 200),
      topicArea: resource.topicArea.slice(0, 120),
      summary: (resource.summary || '').slice(0, 1000),
      content: (resource.content || '').slice(0, 12000),
      languageNote: (resource.languageNote || 'Hindi + English Bilingual').slice(0, 120),
      keyFormulas: resource.keyFormulas.slice(0, 25).map((f) => f.slice(0, 240)),
      published: Boolean(resource.published),
      updatedAt: serverTimestamp(),
    };
    if (resource.pdfUrl?.trim()) {
      payload.pdfUrl = resource.pdfUrl.trim().slice(0, 800000);
    }
    if (resource.pdfName?.trim()) {
      payload.pdfName = resource.pdfName.trim().slice(0, 240);
    }

    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `learningHubItems/${resource.id}`);
  }
}

export async function deleteLearningResourceFromCloud(id: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'learningHubItems', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `learningHubItems/${id}`);
  }
}

/**
 * Syncs local data into Cloud Firestore without erasing existing cloud items.
 */
export async function syncSiteDataToCloudNonDestructive(data: SiteData): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Please connect your Google admin account to sync to the cloud.');
  }

  await saveCoachingAndSocialsToCloud(data.coaching, data.socialLinks);
  await saveTeacherToCloud(data.teacher);

  for (const item of data.gallery) {
    await saveGalleryItemToCloud(item);
  }
  for (const resource of data.learningHub) {
    await saveLearningResourceToCloud(resource);
  }
}
