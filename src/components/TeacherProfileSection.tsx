import { Award, BookOpen, CheckCircle2, GraduationCap } from 'lucide-react';
import type { TeacherProfile } from '../types/coaching';
import { ResilientImage } from './ResilientImage';

interface TeacherProfileSectionProps {
  teacher: TeacherProfile;
}

export function TeacherProfileSection({ teacher }: TeacherProfileSectionProps) {
  return (
    <section id="faculty" className="py-16 lg:py-24 bg-[#09090B] border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <p className="text-sm font-semibold text-red-400 uppercase tracking-wide">
            Teacher Profile &amp; Mentorship
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
            Meet Your Educator
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch bg-[#111318] rounded-2xl border border-zinc-800 p-6 sm:p-8 lg:p-10 shadow-xl">
          {/* Teacher Photo */}
          <div className="lg:col-span-4 flex">
            <div className="w-full min-h-[320px] lg:min-h-full rounded-xl overflow-hidden border border-zinc-800 bg-[#09090B]">
              <ResilientImage
                src={teacher.photoUrl}
                alt={teacher.name}
                fallbackLabel={teacher.name}
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>

          {/* Teacher Details */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {teacher.name}
              </h3>
              <p className="mt-1 text-sm sm:text-base font-medium text-blue-400">
                {teacher.roleTitle}
              </p>

              <p className="mt-5 text-base text-slate-300 leading-relaxed">
                {teacher.introduction}
              </p>

              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-zinc-800">
                <div className="flex items-start gap-3">
                  <GraduationCap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Qualifications</h4>
                    <p className="mt-1 text-sm sm:text-base font-semibold text-white">
                      {teacher.qualifications}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Teaching Experience</h4>
                    <p className="mt-1 text-sm sm:text-base font-semibold text-white">
                      {teacher.experience}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Classes Taught</h4>
                    <p className="mt-1 text-sm sm:text-base font-semibold text-white">
                      {teacher.classesTaught}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subjects Taught</h4>
                    <p className="mt-1 text-sm font-medium text-slate-200 leading-relaxed">
                      {teacher.subjectsTaught.join(' · ')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 pt-6 border-t border-zinc-800">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Core Teaching Skills
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {teacher.skills.map((skill) => (
                  <li
                    key={skill}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <CheckCircle2
                      className="w-4 h-4 text-blue-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{skill}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
