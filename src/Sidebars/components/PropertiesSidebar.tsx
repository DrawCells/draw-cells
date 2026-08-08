import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Input, MenuItem, Select, Slider, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSpritesByIds } from '../../Frames/actions';
import { isArrowSprite, isTextSprite } from '../../Frames/reducers/frames';
import State from '../../stateInterface';
import { toggleProperties } from '../actions';
import BaseSidebar from './BaseSidebar';

// The sidebar displays the first selected sprite's values but applies edits to
// every selected sprite. Sprite mutations are id-addressed, so this reads the
// selection here and passes the ids down to the action. `currentSprites` is
// selected (rather than a derived id array) so the reference stays stable and
// useSelector doesn't re-render on every unrelated store change.
function useUpdateSelectedSprites() {
  const dispatch = useDispatch();
  const currentSprites = useSelector((state: State) => state.frames.currentSprites);
  return (fields: Record<string, any>) =>
    dispatch(updateSpritesByIds({ ids: currentSprites.map((s) => s.id), fields }));
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Input
      type="color"
      disableUnderline
      value={value}
      onChange={onChange}
      sx={{
        '& input[type=color]': {
          width: 56,
          height: 28,
          padding: 0,
          cursor: 'pointer',
        },
        '& input[type=color]::-webkit-color-swatch-wrapper': { padding: 0 },
        '& input[type=color]::-webkit-color-swatch': {
          border: '1px solid #ccc',
          borderRadius: '4px',
        },
        '& input[type=color]::-moz-color-swatch': {
          border: '1px solid #ccc',
          borderRadius: '4px',
        },
      }}
    />
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <TableRow>
      <TableCell colSpan={2}>
        <Typography align="center" variant="body2" style={{ fontWeight: 'bold' }}>{title}</Typography>
      </TableCell>
    </TableRow>
  );
}

function TextProperties({ currentSprite }: any) {
  const updateSelected = useUpdateSelectedSprites();

  // Local state so the field stays responsive while typing; the store update
  // (which is undo-tracked) is debounced so a burst of typing is one undo entry.
  const [textValue, setTextValue] = useState(currentSprite?.text ?? '');
  const timer = useRef<any>(null);
  const spriteId = currentSprite?.id;

  // Reset to the store value when a different sprite is selected, and drop any
  // pending debounced dispatch so it can't land on the newly selected sprite.
  useEffect(() => {
    setTextValue(currentSprite?.text ?? '');
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spriteId]);

  const commit = (value: string) => {
    if (value !== (currentSprite?.text ?? '')) {
      updateSelected({ text: value });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const value = e.target.value;
    setTextValue(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), 400);
  };

  // Flush immediately on blur (e.g. clicking another sprite) so we don't lose
  // the last keystrokes still inside the debounce window.
  const handleBlur = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    commit(textValue);
  };

  return (
    <>
      <SectionHeader title="Text" />
      <TableRow key="text">
        <TableCell>Text</TableCell>
        <TableCell>
          <Input
            multiline
            value={textValue}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </TableCell>
      </TableRow>
      <TableRow key="fontSize">
        <TableCell>Font Size</TableCell>
        <TableCell>
          <Input
            type="number"
            value={currentSprite?.fontSize ?? ''}
            onChange={(e) => updateSelected({ fontSize: parseInt(e.target.value) || 0 })}
          />
        </TableCell>
      </TableRow>
      <TableRow key="fill">
        <TableCell>Color</TableCell>
        <TableCell>
          <ColorInput
            value={currentSprite?.fill || '#000000'}
            onChange={(e) => updateSelected({ fill: e.target.value })}
          />
        </TableCell>
      </TableRow>
      <TableRow key="fontFamily">
        <TableCell>Font</TableCell>
        <TableCell>
          <Select
            size="small"
            value={currentSprite?.fontFamily || 'Arial'}
            onChange={(e) => updateSelected({ fontFamily: e.target.value })}
          >
            <MenuItem value="Arial">Arial</MenuItem>
            <MenuItem value="Times New Roman">Times New Roman</MenuItem>
            <MenuItem value="Courier New">Courier New</MenuItem>
            <MenuItem value="Georgia">Georgia</MenuItem>
            <MenuItem value="Verdana">Verdana</MenuItem>
          </Select>
        </TableCell>
      </TableRow>
      <TableRow key="align">
        <TableCell>Align</TableCell>
        <TableCell>
          <Select
            size="small"
            value={currentSprite?.align || 'left'}
            onChange={(e) => updateSelected({ align: e.target.value })}
          >
            <MenuItem value="left">Left</MenuItem>
            <MenuItem value="center">Center</MenuItem>
            <MenuItem value="right">Right</MenuItem>
          </Select>
        </TableCell>
      </TableRow>
      <TableRow key="fontStyle">
        <TableCell>Style</TableCell>
        <TableCell>
          <Select
            size="small"
            value={currentSprite?.fontStyle || 'normal'}
            onChange={(e) => updateSelected({ fontStyle: e.target.value })}
          >
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="bold">Bold</MenuItem>
            <MenuItem value="italic">Italic</MenuItem>
            <MenuItem value="italic bold">Bold Italic</MenuItem>
          </Select>
        </TableCell>
      </TableRow>
    </>
  );
}

function ArrowProperties({ currentSprite }: any) {
  const updateSelected = useUpdateSelectedSprites();
  return (
    <>
      <SectionHeader title="Arrow" />
      <TableRow key="stroke">
        <TableCell>Color</TableCell>
        <TableCell>
          <ColorInput
            value={currentSprite?.stroke || '#000000'}
            onChange={(e) => updateSelected({ stroke: e.target.value })}
          />
        </TableCell>
      </TableRow>
    </>
  );
}

function ChaoticAnimationProperties({currentSprite}: any) {
  const updateSelected = useUpdateSelectedSprites()
  const [rangeOfMovementSlider, setRangeOfMovementSlider] = useState(currentSprite.rangeOfMovement)
  const [nrOfIterationsSlider, setNrOfIterationsSlider] = useState(currentSprite.nrOfIterations)

  useEffect(() => {
    setRangeOfMovementSlider(currentSprite.rangeOfMovement)
    setNrOfIterationsSlider(currentSprite.nrOfIterations)
  }, [currentSprite])

  return (
    <>
      {/* <TableRow key="minTravelDistance">
        <TableCell>Min. Travel Distance</TableCell>
        <TableCell>
          <Input
            type="number"
            value={currentSprite?.minTravelDistance || ''}
            onChange={(e) => updateSelected({ minTravelDistance: parseInt(e.target.value) })}
          />
        </TableCell>
      </TableRow> */}
      <TableRow key="rangeOfMovement">
        <TableCell>Narrow/Wide</TableCell>
        <TableCell>
          {/* <Input
            type="number"
            value={currentSprite?.rangeOfMovement || ''}
            onChange={(e) => updateSelected({ rangeOfMovement: parseInt(e.target.value) })}
          /> */}
          <Slider
            step={10}
            min={10}
            max={500}
            valueLabelDisplay="auto"
            onChange={(e, newValue) => setRangeOfMovementSlider(newValue)}
            onChangeCommitted={(e, newValue) => updateSelected({ rangeOfMovement: newValue })}
            value={rangeOfMovementSlider}
          />
        </TableCell>
      </TableRow>
      <TableRow key="nrOfIterations">
        <TableCell>Slow/Fast</TableCell>
        <TableCell>
          {/* <Input
            type="number"
            value={currentSprite?.nrOfIterations || ''}
            onChange={(e) => updateSelected({ nrOfIterations: parseInt(e.target.value || '0') })}
          /> */}
          <Slider
            step={1}
            min={1}
            max={30}
            valueLabelDisplay="auto"
            onChange={(e, newValue) => setNrOfIterationsSlider(newValue)}
            onChangeCommitted={(e, newValue) => updateSelected({ nrOfIterations: newValue })}
            value={nrOfIterationsSlider}
          />
        </TableCell>
      </TableRow>
    </>
  )
}

export default function PropertiesSidebar() {
  const dispatch = useDispatch()
  const updateSelected = useUpdateSelectedSprites()
  const isPropertiesSidebarOpen = useSelector((state: State) => state.sidebars.isPropertiesOpen)
  const currentSprites = useSelector((state: State) => state.frames.currentSprites)
  const currentSprite = currentSprites.length <= 0 ? null : currentSprites[0]

  return (
    <BaseSidebar
      isOpen={isPropertiesSidebarOpen}
      toggleOpen={() => dispatch(toggleProperties())}
      iconRenderer={() => isPropertiesSidebarOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      anchor="right"
    >
      <div style={{height: '100%', overflowY: 'auto'}}>
        <Table size="small" style={{width: 'calc(100% - 20px)'}}>
          <TableHead>
            <TableRow>
              <TableCell>Propety</TableCell>
              <TableCell>Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2}>
                <Typography align="center" variant="body2" style={{fontWeight: 'bold'}}>Display</Typography>
              </TableCell>
            </TableRow>
            <TableRow key="id">
              <TableCell>id</TableCell>
              <TableCell>
                <Input
                  value={currentSprite?.id || ''}
                  onChange={(e) => updateSelected({ id: e.target.value })}
                />
              </TableCell>
            </TableRow>
            <TableRow key="positionX">
              <TableCell>Position X</TableCell>
              <TableCell>
                <Input
                  value={currentSprite?.position.x || ''}
                  onChange={(e) => updateSelected({ positionX: e.target.value })}
                />
              </TableCell>
            </TableRow>
            <TableRow key="positionY">
              <TableCell>Position Y</TableCell>
              <TableCell>
                <Input
                  value={currentSprite?.position.y || ''}
                  onChange={(e) => updateSelected({ positionY: e.target.value })}
                />
              </TableCell>
            </TableRow>
            <TableRow key="zIndex">
              <TableCell>z-index</TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={currentSprite?.zIndex || ''}
                  onChange={(e) => updateSelected({ zIndex: e.target.value })}
                />
              </TableCell>
            </TableRow>
            {currentSprite && isTextSprite(currentSprite) && (
              <TextProperties currentSprite={currentSprite} />
            )}
            {currentSprite && isArrowSprite(currentSprite) && (
              <ArrowProperties currentSprite={currentSprite} />
            )}
            <TableRow>
              <TableCell colSpan={2}>
                <Typography align="center" variant="body2" style={{fontWeight: 'bold'}}>Animation</Typography>
              </TableCell>
            </TableRow>
            <TableRow key="duration">
              <TableCell>Duration</TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={currentSprite?.duration || ''}
                  onChange={(e) => updateSelected({ duration: parseInt(e.target.value) })}
                />
              </TableCell>
            </TableRow>
            <TableRow key="animationType">
              <TableCell>Animation Type</TableCell>
              <TableCell>
                <Select
                  value={currentSprite?.animationType || ''}
                  onChange={(e) => updateSelected({ animationType: e.target.value })}
                  size="small"
                >
                  <MenuItem value="LINEAR">Linear</MenuItem>
                  <MenuItem value="CHAOTIC">Chaotic</MenuItem>
                  <MenuItem value="CIRCULAR">Circular</MenuItem>
                </Select>
              </TableCell>
            </TableRow>
            {currentSprite?.animationType === 'CHAOTIC' && (
              <ChaoticAnimationProperties currentSprite={currentSprite} />
            )}
            {currentSprite?.animationType === 'CIRCULAR' && (<TableRow key="circleDirection">
              <TableCell>Circle Direction</TableCell>
              <TableCell>
                <Select
                  value={currentSprite?.circleDirection || 1}
                  onChange={(e) => updateSelected({ circleDirection: e.target.value })}
                  size="small"
                >
                  <MenuItem value={1}>Upwards</MenuItem>
                  <MenuItem value={-1}>Downwards</MenuItem>
                </Select>
              </TableCell>
            </TableRow>)}
            {currentSprite?.animationType === 'CIRCULAR' && (<TableRow key="angle">
              <TableCell>Angle</TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={currentSprite?.angle || ''}
                  onChange={(e) => updateSelected({ angle: e.target.value })}
                />
              </TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </div>
    </BaseSidebar>
  );
}