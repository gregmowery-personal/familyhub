# Page snapshot

```yaml
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- navigation:
  - button "previous" [disabled]:
    - img "previous"
  - text: 1/1
  - button "next" [disabled]:
    - img "next"
- link "Next.js 15.4.5 (stale) Webpack":
  - /url: https://nextjs.org/docs/messages/version-staleness
  - img
  - text: Next.js 15.4.5 (stale) Webpack
- dialog "Build Error":
  - text: Build Error
  - button "Copy Stack Trace":
    - img
  - button "No related documentation found" [disabled]:
    - img
  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools":
    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
    - img
  - paragraph: x Expected '</', got 'className'
  - img
  - text: ./src/components/LoginPageRedesign.tsx
  - button "Open in editor":
    - img
  - text: "Error: x Expected '</', got 'className' ,-[/Users/gregmowery/familyhub/src/components/LoginPageRedesign.tsx:277:1] 274 | /> 275 | ) : ( 276 | {/* Form Header */} 277 | <div className=\"text-center mb-8\"> : ^^^^^^^^^ 278 | <h3 className=\"text-2xl font-bold text-slate-800 mb-2\"> 279 | {!isCodeStep ? 'Sign in to your account' : 'Enter verification code'} 280 | </h3> `---- Caused by: Syntax Error"
- alert
```