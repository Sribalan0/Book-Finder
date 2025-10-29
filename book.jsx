import React, { useEffect, useState } from 'react';

// BookFinder.jsx
// Single-file React component (TailwindCSS assumed available globally)
// Default export: BookFinder component

export default function BookFinder() {
  const [query, setQuery] = useState('');
  const [searchBy, setSearchBy] = useState('title'); // title | author | isbn
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [numFound, setNumFound] = useState(0);
  const [selected, setSelected] = useState(null); // full book data for modal
  const [filters, setFilters] = useState({ yearFrom: '', yearTo: '', subject: '' });
  const [sortBy, setSortBy] = useState('relevance'); // relevance | newest | oldest
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bf_favs') || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('bf_favs', JSON.stringify(favorites));
  }, [favorites]);

  // Build OpenLibrary search query - this is forgiving and simple
  const buildQuery = () => {
    if (!query.trim()) return '';
    const prefix = searchBy === 'title' ? 'title:' : searchBy === 'author' ? 'author:' : 'isbn:';
    return `${prefix}${query.trim()}`;
  };

  const search = async (opts = {}) => {
    const q = buildQuery();
    if (!q) {
      setError('Please enter a search term (title, author or ISBN).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      const url = new URL('https://openlibrary.org/search.json');
      url.searchParams.set('q', q);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));

      // add simple filters
      if (filters.subject) url.searchParams.set('subject', filters.subject);
      if (filters.yearFrom) url.searchParams.set('first_publish_year', `>=${filters.yearFrom}`);
      if (filters.yearTo) url.searchParams.set('first_publish_year', `<=${filters.yearTo}`);

      const resp = await fetch(url.toString());
      if (!resp.ok) throw new Error('Search failed');
      const data = await resp.json();

      let docs = data.docs || [];
      // Apply year range filter client-side if OpenLibrary params were insufficient
      if (filters.yearFrom || filters.yearTo) {
        docs = docs.filter(d => {
          const y = d.first_publish_year || d.publish_year?.[0] || null;
          if (!y) return false;
          if (filters.yearFrom && y < Number(filters.yearFrom)) return false;
          if (filters.yearTo && y > Number(filters.yearTo)) return false;
          return true;
        });
      }

      // Sorting
      if (sortBy === 'newest') docs.sort((a, b) => (b.first_publish_year || 0) - (a.first_publish_year || 0));
      else if (sortBy === 'oldest') docs.sort((a, b) => (a.first_publish_year || 0) - (b.first_publish_year || 0));

      setResults(docs);
      setNumFound(data.numFound || docs.length);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If page changes, re-run search (but only if there's a query)
    if (query.trim()) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openDetails = async (doc) => {
    // fetch work/edition details if possible for richer modal
    setSelected({ loading: true, base: doc });
    try {
      if (doc.key) {
        const workUrl = `https://openlibrary.org${doc.key}.json`;
        const r = await fetch(workUrl);
        if (r.ok) {
          const w = await r.json();
          setSelected({ loading: false, base: doc, work: w });
          return;
        }
      }
      setSelected({ loading: false, base: doc });
    } catch (err) {
      console.error(err);
      setSelected({ loading: false, base: doc });
    }
  };

  const thumbUrl = (doc) => {
    // preference: cover_i -> ISBN -> OLID
    if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
    if (doc.isbn && doc.isbn[0]) return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
    if (doc.edition_key && doc.edition_key[0]) return `https://covers.openlibrary.org/b/olid/${doc.edition_key[0]}-M.jpg`;
    return null;
  };

  const toggleFav = (doc) => {
    const id = doc.key || doc.cover_edition_key || doc.edition_key?.[0] || doc.isbn?.[0] || JSON.stringify(doc);
    if (favorites.find(f => f.id === id)) {
      setFavorites(favorites.filter(f => f.id !== id));
    } else {
      setFavorites([...favorites, { id, title: doc.title, author_name: doc.author_name, cover: thumbUrl(doc) }]);
    }
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setNumFound(0);
    setPage(1);
    setError(null);
  };

  return (<div />);
}
