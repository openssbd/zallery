export const config = {
  /** Path to the CSV file served from public/ */
  csvPath: `${import.meta.env.BASE_URL}bff-ssbd-database-omezarr04.csv`,

  /** Browser tab title (document.title) */
  siteTitle: 'SSBD OME-Zarr Image Gallery',

  /** H1 shown in the page header */
  siteHeading: 'SSBD OME-Zarr Image Gallery',

  /** Description shown below the heading */
  siteSubtitle:
    'A gallery of OME-Zarr image datasets from the SSBD database, showcasing reusable bioimage data for visualization, exploration, and tool development.',

  /**
   * Optional extra link appended to the subtitle ("To browse via <text>.")
   * Set to null to hide.
   */
  subtitleLink: {
    text: 'BioFile Finder',
    url: 'https://ssbd.riken.jp/ssbd-bff/',
  } as { text: string; url: string } | null,
}
