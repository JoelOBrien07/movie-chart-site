const chartSelector = document.getElementById("chartSelector");
const filterControls = document.getElementById("filterControls");

// Format numbers to short form like 1.2M, 500K, etc.
function formatNumber(value) {
  if (value === null || isNaN(value)) return 'N/A';
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  return value.toFixed(0);
}

// Dynamically render filters
function renderFilters(type) {
  filterControls.innerHTML = ''; // Clear existing filters

  if (type === 'yearVsRating' || type === 'ratingVsBoxOffice') {
    const yearSelect = document.createElement('select');
    yearSelect.id = 'yearFilter';
    yearSelect.style.background = '#2b2b2b';
    yearSelect.style.color = 'white';
    yearSelect.style.border = '1px solid #444';
    yearSelect.style.padding = '5px';
    yearSelect.style.borderRadius = '4px';

    // Determine range of decades based on data min/max year
    const years = allData.map(m => m.year).filter(y => y);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    // Build decade options (every 10 years)
    for (let start = Math.floor(minYear / 10) * 10; start <= maxYear; start += 10) {
      const end = start + 9;
      const option = document.createElement('option');
      option.value = `${start}-${end}`;
      option.textContent = `${start} - ${end}`;
      yearSelect.appendChild(option);
    }

    // Add a default "All years" option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All years';
    yearSelect.insertBefore(allOption, yearSelect.firstChild);
    yearSelect.value = 'all';

    yearSelect.onchange = renderChart;
    filterControls.appendChild(yearSelect);
  }
}

chartSelector.addEventListener("change", () => {
  renderFilters(chartSelector.value);
  renderChart();
});

let allData = [];
const urlParams = new URLSearchParams(window.location.search);
const defaultChart = urlParams.get('type') || 'budgetVsBoxOffice';
chartSelector.value = defaultChart;

fetch('movieData.json')
  .then(res => res.json())
  .then(data => {
    allData = data;
    renderFilters(chartSelector.value);
    renderChart();
  });

function renderChart() {
  const type = chartSelector.value;
  const data = allData;

  let x = [], y = [], ids = [], xTitle = '', yTitle = '';

  // Get filter value if present
  const yearFilter = document.getElementById('yearFilter')?.value || 'all';

  // Filter data by year range if filter applied
  let filteredData = data;
  if (yearFilter !== 'all') {
    const [startYear, endYear] = yearFilter.split('-').map(Number);
    filteredData = data.filter(m => m.year >= startYear && m.year <= endYear);
  }

  switch (type) {
    case 'budgetVsBoxOffice':
      x = filteredData.map(m => parseFloat(m.budget.replace(/[^0-9.]/g, '')));
      y = filteredData.map(m => parseFloat(m.gross_worldwide.replace(/[^0-9.]/g, '')));
      xTitle = 'Budget ($)';
      yTitle = 'Box Office ($)';
      break;

    case 'ratingVsBoxOffice':
      x = filteredData.map(m => m.rating);
      y = filteredData.map(m => parseFloat(m.gross_worldwide.replace(/[^0-9.]/g, '')));
      xTitle = 'IMDb Rating';
      yTitle = 'Box Office ($)';
      break;

    case 'yearVsRating':
      x = filteredData.map(m => m.year);
      y = filteredData.map(m => m.rating);
      xTitle = 'Release Year';
      yTitle = 'IMDb Rating';
      break;

    case 'awardsVsBoxOffice':
      x = filteredData.map(m => {
        const awardsText = m.awards_content || '';
        // Extract only the "X wins" part (exclude Oscars)
        const winsMatch = awardsText.match(/(\d+)\s+wins?/i);
        return winsMatch ? parseInt(winsMatch[1]) : 0;
      });
      y = filteredData.map(m => parseFloat(m.gross_worldwide.replace(/[^0-9.]/g, '')));
      xTitle = 'Award Wins (excluding Oscars)';
      yTitle = 'Box Office ($)';
      break;

    case 'roi':
      // Filter movies with valid budget > 0 and ROI calculated, apply year filter too
      const moviesWithROI = filteredData
        .map((m, i) => {
          const budget = parseFloat(m.budget.replace(/[^0-9.]/g, ''));
          const boxOffice = parseFloat(m.gross_worldwide.replace(/[^0-9.]/g, ''));
          const roi = budget > 0 ? boxOffice / budget : null;
          return { movie: m, roi, index: i };
        })
        .filter(d => d.roi !== null)
        .sort((a, b) => b.roi - a.roi);

      const TOP_N = 50; // Show only top 50 movies by ROI
      const topMovies = moviesWithROI.slice(0, TOP_N);

      x = topMovies.map(d => d.movie.title || `Movie ${d.index + 1}`);
      y = topMovies.map(d => Number(d.roi.toFixed(2)));
      ids = topMovies.map(d => d.index);

      xTitle = 'Movie';
      yTitle = 'ROI (Box Office ÷ Budget)';
      break;
  }

  // For ROI, ids already set, else map to filteredData indexes
  if (type !== 'roi') {
    ids = filteredData.map((_, i) => i);
  }

  const trace = {
    x,
    y,
    text: filteredData.map(m => m.title),
    customdata: ids,
    mode: (type === 'roi') ? undefined : 'markers',
    type: (type === 'roi') ? 'bar' : 'scatter',
    marker: {
      size: 12,
      color: '#e50914',
      line: { color: '#fff', width: 0.5 },
      opacity: 0.8
    },
    hovertemplate: (type === 'roi')
      ? '%{x}<br><b>ROI: %{y}x</b><extra></extra>'
      : '%{text}<br><b>%{y}</b><extra></extra>'
  };

  const layout = {
    title: type.replace(/([A-Z])/g, ' $1'),
    hovermode: 'closest',
    plot_bgcolor: '#141414',
    paper_bgcolor: '#141414',
    font: { color: 'white' },
    margin: { t: 60, b: 120, l: 80, r: 20 },
    xaxis: {
      title: xTitle,
      gridcolor: '#444',
      tickangle: (type === 'roi') ? -45 : 0,
      automargin: true,
      tickformat: (type === 'budgetVsBoxOffice' || type === 'awardsVsBoxOffice')
        ? '' : undefined
    },
    yaxis: {
      title: yTitle,
      gridcolor: '#444',
      tickformat: ',.2s' // shorten large numbers (1.2M, etc.)
    }
  };

  Plotly.newPlot('chart', [trace], layout);

  document.getElementById('movie-info').innerHTML = `<p>Click a data point to see movie details</p>`;

  document.getElementById('chart').on('plotly_click', function(event) {
    const index = event.points[0].customdata;
    const movie = filteredData[index];
    document.getElementById('movie-info').innerHTML = `
      <img src="${movie.poster || ''}" />
      <h2>${movie.title} (${movie.year})</h2>
      <p><strong>Rating:</strong> ${movie.rating}</p>
      <p><strong>MPA:</strong> ${movie.MPA || 'N/A'}</p>
      <p><strong>Duration:</strong> ${movie.duration || 'N/A'}</p>
      <p><strong>Awards:</strong> ${movie.awards_content || 'None'}</p>
      <p><strong>Budget:</strong> ${movie.budget}</p>
      <p><strong>Box Office:</strong> ${movie.gross_worldwide}</p>
      <p><strong>ROI:</strong> ${
        (() => {
          const budget = parseFloat(movie.budget.replace(/[^0-9.]/g, ''));
          const boxOffice = parseFloat(movie.gross_worldwide.replace(/[^0-9.]/g, ''));
          return budget > 0 ? (boxOffice / budget).toFixed(2) + 'x' : 'N/A';
        })()
      }</p>
      <p><strong>Description:</strong><br>${movie.description || 'No description available.'}</p>
    `;
  });
}
