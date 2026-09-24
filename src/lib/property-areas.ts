// Suggested areas for the Storm Property Record's pick screen. The user can type their own too.

// Plain names, no ids — an area is saved by its name, so a suggestion and a typed-in
// area end up as the same kind of row.
export const AREA_SECTIONS = [
  {
    title: 'Outside',
    areas: [
      'Front of house',
      'Back of house',
      'Roof',
      'Garage',
      'Windows',
      'Fence',
      'Patio or balcony',
      'Pool or screen enclosure',
    ],
  },
  {
    title: 'Inside',
    areas: ['Living room', 'Kitchen', 'Bedrooms'],
  },
  {
    title: 'Other',
    areas: ['Vehicle', 'Valuables'],
  },
];
