import {ref, reactive} from 'vue'

export function useDiagramEditor() {
    // State
    const elements = ref([])
    const connections = ref([])
    const selectedElement = ref(null)
    const currentTool = ref(null)
    const zoom = ref(1)
    const diagrams = ref([])
    const diagramName = ref('')
    const diagramType = ref('class')
    const currentDiagramId = ref(null)
    const connectionStart = ref(null)

    // Methods
    const setTool = (tool) => {
        currentTool.value = tool
        connectionStart.value = null
    }

    const selectElement = (element) => {
        selectedElement.value = element
    }

    const moveElement = (elementId, newX, newY) => {
        const element = elements.value.find(el => el.id === elementId)
        if (element) {
            element.x = newX
            element.y = newY
            updateConnections()
        }
    }

    const createElement = (type, x, y) => {
        const element = {
            id: generateId(),
            type,
            x,
            y,
            width: 120,
            height: 60,
            text: getDefaultText(type),
            properties: {}
        }

        elements.value.push(element)
        selectedElement.value = element
    }

    const createConnection = (fromElement, toElement) => {
        if (!currentTool.value) return

        const connection = {
            id: generateId(),
            from: fromElement.id,
            to: toElement.id,
            type: currentTool.value,
            label: '',
            points: calculateConnectionPoints(fromElement, toElement)
        }

        connections.value.push(connection)
        currentTool.value = null
        connectionStart.value = null
    }

    const updateElement = (elementId, updates) => {
        const element = elements.value.find(el => el.id === elementId)
        if (element) {
            Object.assign(element, updates)
        }
    }

    const deleteSelected = () => {
        if (selectedElement.value) {
            const elementId = selectedElement.value.id
            elements.value = elements.value.filter(el => el.id !== elementId)
            connections.value = connections.value.filter(
                conn => conn.from !== elementId && conn.to !== elementId
            )
            selectedElement.value = null
        }
    }

    const zoomIn = () => {
        zoom.value = Math.min(5, zoom.value * 1.2)
    }

    const zoomOut = () => {
        zoom.value = Math.max(0.1, zoom.value * 0.8)
    }

    const resetZoom = () => {
        zoom.value = 1
    }

    // API Methods
    const saveDiagram = async () => {
        try {
            const svgData = exportToSVG()
            const diagramData = {
                name: diagramName.value || 'Unnamed Diagram',
                type: diagramType.value,
                svg_data: svgData
            }

            let response
            if (currentDiagramId.value) {
                response = await fetch(`/api/v1/diagrams/${currentDiagramId.value}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(diagramData)
                })
            } else {
                response = await fetch('/api/v1/diagrams', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(diagramData)
                })
            }

            if (response.ok) {
                const result = await response.json()
                currentDiagramId.value = result.id
                alert('Diagram saved successfully!')
                loadDiagramsList()
            } else {
                throw new Error('Failed to save diagram')
            }
        } catch (error) {
            console.error('Error saving diagram:', error)
            alert('Error saving diagram: ' + error.message)
        }
    }

    const newDiagram = () => {
        elements.value = []
        connections.value = []
        selectedElement.value = null
        currentDiagramId.value = null
        diagramName.value = ''
        currentTool.value = null
    }

    const loadDiagram = async (id) => {
        try {
            const response = await fetch(`/api/v1/diagrams/${id}`)
            if (response.ok) {
                const diagram = await response.json()
                // For now, just set the SVG content
                // In a real app, you'd parse the SVG and recreate elements/connections
                currentDiagramId.value = id
                diagramName.value = diagram.name
                diagramType.value = diagram.type
            } else {
                throw new Error('Failed to load diagram')
            }
        } catch (error) {
            console.error('Error loading diagram:', error)
            alert('Error loading diagram: ' + error.message)
        }
    }

    const loadDiagramsList = async () => {
        try {
            const response = await fetch('/api/v1/diagrams')
            if (response.ok) {
                const data = await response.json()
                diagrams.value = data.items
            }
        } catch (error) {
            console.error('Error loading diagrams list:', error)
        }
    }

    // Helper methods
    const generateId = () => 'elem_' + Math.random().toString(36).substr(2, 9)

    const getDefaultText = (type) => {
        const texts = {
            class: 'New Class',
            interface: 'New Interface',
            enum: 'New Enum',
            actor: 'Actor',
            usecase: 'Use Case',
            note: 'Note',
            package: 'Package'
        }
        return texts[type] || 'Element'
    }

    const calculateConnectionPoints = (fromElement, toElement) => {
        const fromCenter = {
            x: fromElement.x + fromElement.width / 2,
            y: fromElement.y + fromElement.height / 2
        }
        const toCenter = {
            x: toElement.x + toElement.width / 2,
            y: toElement.y + toElement.height / 2
        }
        return [{x: fromCenter.x, y: fromCenter.y}, {x: toCenter.x, y: toCenter.y}]
    }

    const updateConnections = () => {
        connections.value.forEach(conn => {
            const fromElement = elements.value.find(el => el.id === conn.from)
            const toElement = elements.value.find(el => el.id === conn.to)
            if (fromElement && toElement) {
                conn.points = calculateConnectionPoints(fromElement, toElement)
            }
        })
    }

    const exportToSVG = () => {
        // TODO
        return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <!-- Diagram elements would be rendered here -->
    </svg>`
    }

    return {
        // State
        elements,
        connections,
        selectedElement,
        currentTool,
        zoom,
        diagrams,
        diagramName,
        diagramType,
        currentDiagramId,
        connectionStart,

        // Methods
        setTool,
        selectElement,
        moveElement,
        createElement,
        createConnection,
        updateElement,
        deleteSelected,
        zoomIn,
        zoomOut,
        resetZoom,
        saveDiagram,
        newDiagram,
        loadDiagram,
        loadDiagramsList
    }
}