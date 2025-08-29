# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Pages repository containing multiple Genesys Cloud client application demos and widgets. It serves as a collection of web-based tools and examples for integrating with Genesys Cloud APIs and Spark UI components.

## Architecture

The repository is organized into multiple standalone HTML applications, each demonstrating specific Genesys Cloud functionality:

- **AA/**: Agent Assist iframe communication demo with external CSS styling
- **ADDIPOCWidget/**: Widget for ADDI (AI-powered agent assist) proof of concept
- **ConversationParse/**: Tool for parsing and analyzing conversation data with syntax highlighting
- **DirectoryExample/**: Client application directory examples with table functionality
- **TranscriptionExample/**: Real-time transcription widget
- **WorkItemForms/**: Custom work item form examples
- **deployments/**: Production deployment versions of various widgets

Each application follows a similar pattern:
- HTML entry point with embedded JavaScript
- Genesys Spark UI components for consistent styling
- Genesys Cloud Platform Client SDK for API interactions
- Query parameter-based configuration (gc_region, gc_clientId, etc.)

## Development Commands

### Genesys Spark Components (within subdirectories)
For applications with genesys-spark/ subdirectories:
```bash
cd [application]/genesys-spark/
npm run build          # Build the Spark components
npm run dev            # Development mode with watching
npm run test           # Run Jest tests
npm run eslint         # Lint TypeScript files
npm run prettier       # Format code
npm run stylelint      # Lint CSS/SCSS files
```

### Static Site Development
This is a static site repository - no build process required for the main HTML files. Simply:
- Edit HTML files directly
- Test locally by opening files in browser or using a local server
- Deploy by pushing to the repository (GitHub Pages auto-deploys)

## Key Technical Details

### Authentication Flow
Most widgets use OAuth implicit flow with Genesys Cloud:
- Parameters: `gc_region`, `gc_clientId`, `gc_redirectUrl`
- Session storage used to persist auth state
- Platform Client SDK handles token management

### Common Dependencies
- **Genesys Spark Components**: UI component library loaded via CDN
- **Genesys Platform Client SDK**: API client loaded from `sdk-cdn.mypurecloud.com`
- **External libraries**: Highlight.js for syntax highlighting in some demos

### Configuration Pattern
Applications expect URL parameters for configuration:
```
?gc_region=mypurecloud.com&gc_clientId=xxx&gc_redirectUrl=xxx&gc_conversationId=xxx
```

### File Structure Standards
- `index.html`: Main application entry point
- `style/`: Custom CSS (when present)
- `styles.css`: External CSS file (AA/ folder uses this pattern)
- `scripts/`: JavaScript modules and configuration files
- `genesys-spark/`: Local Spark component builds (when customized)

### AA/ Folder Specific Notes
The Agent Assist iframe communication demo (`AA/iframe-communication-demo.html`) has been refactored to use external CSS:
- CSS extracted from inline `<style>` blocks into `AA/styles.css`
- HTML file references external stylesheet via `<link rel="stylesheet" href="styles.css">`
- Original file (`iframe-communication-demo-original.html`) maintains inline CSS for reference

## Working with This Repository

### Adding New Widgets
1. Create new directory following naming convention
2. Include `index.html` with standard Genesys Cloud integration pattern
3. Use query parameter configuration for flexibility
4. Follow existing authentication and SDK patterns

### Modifying Existing Widgets
- Edit HTML files directly for UI/functionality changes
- Modify `genesys-spark/` components if custom Spark behavior needed
- Test with appropriate Genesys Cloud org and client ID

### Deployment
Changes are automatically deployed to GitHub Pages when pushed to main branch. No build step required for the static HTML files.