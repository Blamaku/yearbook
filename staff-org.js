// =====================================================
//  GLUK YEARBOOK 2026 — WHERE STAFF WORK (shared by staff.js and university.js)
//
//  The schools and faculties (the same as the students' DEPT_COURSES_MAP in app.js), the university's
//  offices and services, the campuses, and the departments usually found in each school. The staff form
//  asks from these lists, so the "Schools and offices" chart on Know your university can group everyone.
//  The api checks the campus and the lead level (supabase-api/index.ts: STAFF_CAMPUSES, STAFF_LEAD_LEVELS).
// =====================================================
(function () {
  'use strict';
  const SCHOOLS = Object.keys(window.DEPT_COURSES_MAP || {}).length ? Object.keys(window.DEPT_COURSES_MAP) : [
    'School of Medicine', 'School of Nursing and Midwifery', 'School of Public Health', 'Faculty of Education',
    'Faculty of Humanities and Social Sciences', 'Faculty of Agribusiness and Technology', 'School of Business Administration'];
  // Departments usually found in each school (from its programmes); staff may type their own
  const DEPTS = {
    'School of Medicine': ['Clinical Medicine', 'Physiotherapy', 'Medical Laboratory Science', 'Medical Education', 'Biology', 'Anatomy and Physiology'],
    'School of Nursing and Midwifery': ['Nursing', 'Midwifery', 'Community Health Nursing'],
    'School of Public Health': ['Public Health', 'Community Health and Development', 'Community Nutrition and Dietetics', 'Health Service Management'],
    'Faculty of Education': ['Arts Education', 'Science Education', 'Special Needs Education', 'Educational Psychology', 'Technical Education'],
    'Faculty of Humanities and Social Sciences': ['Counseling Psychology', 'Leadership and Governance', 'Theology'],
    'Faculty of Agribusiness and Technology': ['Agribusiness Management', 'Information Technology', 'Hospitality and Tourism', 'Business Administration'],
    'School of Business Administration': ['Accounting', 'Finance', 'Human Resource Management', 'Procurement and Supply Chain Management'],
  };
  const OFFICES = ['Office of the Vice Chancellor', 'Office of the DVC (Finance, Administration and Planning)',
    'Office of the DVC (Academic, Student Affairs and Research)', 'Academic Registry', 'Administration Registry', 'Admissions',
    'Examinations', 'Dean of Students Office', 'Library', 'ICT', 'Finance Office', 'Human Resources', 'Procurement',
    'Internal Audit', 'Quality Assurance', 'Research and Innovation', 'External Affairs and Partnerships', 'Nairobi Campus Office',
    'Health Unit', 'Chaplaincy', 'Counselling', 'Sports and Games', 'Hostels', 'Estates and Maintenance', 'Security',
    'Catering', 'Transport', 'Alumni Office'];
  const CAMPUSES = ['Main campus, Kisumu', 'Milimani', 'Nairobi', 'More than one campus'];
  const LEAD = {
    school: { label: 'Yes, I lead the school or faculty (Dean, Principal)', office: 'Yes, I head this office' },
    department: { label: 'Yes, I lead my department (Chair, Head)', office: 'Yes, I lead a section of it' },
    programme: { label: 'I coordinate a programme or unit', office: 'I coordinate a unit or service' },
  };
  const isSchool = d => SCHOOLS.includes(d);
  window.GLUK_ORG = { SCHOOLS, DEPTS, OFFICES, CAMPUSES, LEAD, isSchool };
})();
