export type GalleryCategory =
  | 'coaching'
  | 'classroom'
  | 'activities'
  | 'events'
  | 'videos'
  | 'pdfs';

export type MediaType = 'image' | 'video' | 'pdf';

export interface CoachingInfo {
  name: string;
  tagline: string;
  welcomeHeadline: string;
  welcomeSubtitle: string;
  aboutHeading: string;
  aboutDescription: string;
  classesRangeText: string;
  address: string;
  googleMapsUrl: string;
  phone: string;
  email: string;
  officeHours: string;
  heroMediaUrl?: string;
  heroMediaType?: 'image' | 'video';
}

export interface SocialLinks {
  whatsapp: string;
  instagram: string;
  facebook: string;
  youtube: string;
}

export interface TeacherProfile {
  name: string;
  roleTitle: string;
  photoUrl: string;
  introduction: string;
  qualifications: string;
  experience: string;
  skills: string[];
  classesTaught: string;
  subjectsTaught: string[];
}

export interface GalleryItem {
  id: string;
  title: string;
  caption: string;
  category: GalleryCategory;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  published: boolean;
  createdAt: string;
}

export interface LearningResource {
  id: string;
  title: string;
  topicArea: string;
  summary: string;
  content: string;
  languageNote: string;
  keyFormulas: string[];
  pdfUrl?: string;
  pdfName?: string;
  published: boolean;
  updatedAt: string;
}

export interface EnquiryItem {
  id: string;
  studentName: string;
  phoneOrEmail: string;
  message: string;
  createdAt: string;
}

export interface SiteData {
  coaching: CoachingInfo;
  socialLinks: SocialLinks;
  teacher: TeacherProfile;
  gallery: GalleryItem[];
  learningHub: LearningResource[];
  enquiries?: EnquiryItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}
