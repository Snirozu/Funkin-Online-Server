import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'
import { getHost } from '../Util'

function App() {
  return (
    <ApiReferenceReact
      configuration={{
        url: getHost() + '/api.json',
        agent: {
            disabled: true,
        },
      }}
    />
  )
}

export default App