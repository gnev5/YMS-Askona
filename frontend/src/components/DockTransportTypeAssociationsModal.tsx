import React, { useState, useEffect } from 'react';

// Assuming schemas are similar to backend schemas
interface TransportType {
  id: number;
  name: string;
}

interface Dock {
  id: number;
  name: string;
  available_transport_types: TransportType[];
}

interface DockTransportTypeAssociationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dockId: number, transportTypeIds: number[]) => void;
  dock: Dock | null;
}

const DockTransportTypeAssociationsModal: React.FC<DockTransportTypeAssociationsModalProps> = ({ isOpen, onClose, onSave, dock }) => {
  const [allTransportTypes, setAllTransportTypes] = useState<TransportType[]>([]);
  const [selectedTransportTypeIds, setSelectedTransportTypeIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Fetch all available transport types when the modal is opened
    if (isOpen) {
      // NOTE: Ensure the API endpoint is correct.
      fetch('/api/transport-types/')
        .then(res => res.json())
        .then((data: TransportType[]) => {
          setAllTransportTypes(data);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    // When a dock is provided, initialize the selected transport types
    if (dock) {
      setSelectedTransportTypeIds(new Set(dock.available_transport_types.map(t => t.id)));
    }
  }, [dock]);

  if (!isOpen || !dock) {
    return null;
  }

  const handleCheckboxChange = (transportTypeId: number) => {
    const newSelection = new Set(selectedTransportTypeIds);
    if (newSelection.has(transportTypeId)) {
      newSelection.delete(transportTypeId);
    } else {
      newSelection.add(transportTypeId);
    }
    setSelectedTransportTypeIds(newSelection);
  };

  const handleSave = () => {
    onSave(dock.id, Array.from(selectedTransportTypeIds));
  };
  
  // Basic modal styling (re-used from other modals)
  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    padding: '20px 40px',
    borderRadius: '8px',
    zIndex: 1000,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '400px',
  };

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  };
  
  const headerStyle: React.CSSProperties = {
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '1px solid #eee'
  };

  const listStyle: React.CSSProperties = {
      maxHeight: '300px',
      overflowY: 'auto',
      marginBottom: '20px'
  };

  const buttonContainerStyle: React.CSSProperties = {
      textAlign: 'right'
  };

  return (
    <>
      <div style={backdropStyle} onClick={onClose} />
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3>Привязка типов перевозок для дока: {dock.name}</h3>
        </div>
        <div style={listStyle}>
          {allTransportTypes.length > 0 ? (
            allTransportTypes.map(tt => (
              <div key={tt.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTransportTypeIds.has(tt.id)}
                    onChange={() => handleCheckboxChange(tt.id)}
                  />
                  {tt.name}
                </label>
              </div>
            ))
          ) : (
            <p>Загрузка типов перевозок...</p>
          )}
        </div>
        <div style={buttonContainerStyle}>
          <button onClick={onClose} style={{ marginRight: '10px' }}>Отмена</button>
          <button onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </>
  );
};

export default DockTransportTypeAssociationsModal;
