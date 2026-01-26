# VR Shader Experience

## Overview

This is a WebXR virtual reality application built with React Three Fiber that renders an immersive shader-based environment. Users can enter VR mode through compatible headsets (like Meta Quest) to experience procedurally generated visual effects inside a 3D sphere. The application features a full-stack architecture with an Express backend and React frontend, designed for real-time 3D rendering with WebGL shaders.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **3D Rendering**: React Three Fiber (@react-three/fiber) as the React renderer for Three.js
- **VR/XR Support**: @react-three/xr for WebXR integration, enabling immersive VR experiences
- **Shader System**: Custom GLSL shaders compiled via vite-plugin-glsl for procedural visual effects
- **State Management**: Zustand for lightweight game state and audio management
- **UI Components**: Radix UI primitives with shadcn/ui component library, styled with Tailwind CSS
- **Data Fetching**: TanStack React Query for server state management

### Backend Architecture
- **Server**: Express.js with TypeScript running on Node.js
- **Build System**: Vite for frontend bundling, esbuild for server bundling
- **Development**: Hot module replacement via Vite dev server with custom HMR path
- **Static Serving**: Production builds serve from dist/public directory

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: shared/schema.ts contains database table definitions
- **Current Storage**: In-memory storage implementation (MemStorage class) with interface for database migration
- **Schema Push**: Uses drizzle-kit for database migrations via `npm run db:push`

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/  # UI and 3D components
│   │   ├── lib/         # Utilities and state stores
│   │   └── pages/       # Page components
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared types and schema
│   └── schema.ts     # Drizzle database schema
```

### Key Design Patterns
- **Shared Schema**: Database schema and types defined in shared/ directory, accessible to both frontend and backend via path aliases
- **Storage Interface**: IStorage interface abstracts data operations, allowing easy swap between memory and database implementations
- **Component-Based 3D**: 3D scene elements built as React components using React Three Fiber's declarative approach

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via DATABASE_URL environment variable)
- **Drizzle ORM**: Type-safe SQL query builder and schema management

### Third-Party Libraries
- **Three.js Ecosystem**: Core 3D rendering with React Three Fiber, Drei (helpers), and postprocessing effects
- **WebXR**: Native browser API accessed through @react-three/xr for VR headset support
- **Radix UI**: Headless UI primitives for accessible component building
- **Tailwind CSS**: Utility-first CSS framework with custom theme configuration

### Build Tools
- **Vite**: Frontend build tool with HMR, React plugin, and GLSL shader support
- **esbuild**: Fast server-side bundling for production builds
- **TypeScript**: Full type safety across client, server, and shared code

### Environment Requirements
- DATABASE_URL: PostgreSQL connection string (required for database features)
- Node.js with ES modules support (type: "module" in package.json)