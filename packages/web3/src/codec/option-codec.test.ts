/*
Copyright 2018 - 2022 The Alephium Authors
This file is part of the alephium project.

The library is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

The library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with the library. If not, see <http://www.gnu.org/licenses/>.
*/
import { OptionCodec } from './option-codec'
import { intAs4BytesCodec } from './int-as-4bytes-codec'

describe('Encode & decode options', function () {
  it('should encode and decode options', function () {
    const optionalStringCodec = new OptionCodec(intAs4BytesCodec)

    const none = { option: 0 }
    const encodedNone = optionalStringCodec.encode(none)
    const decodedNone = optionalStringCodec.decode(encodedNone)
    expect(none).toEqual(decodedNone)

    const option = { option: 1, value: 1000 }
    const encodedOption = optionalStringCodec.encode(option)
    const decodedOption = optionalStringCodec.decode(encodedOption)
    expect(option).toEqual(decodedOption)
  })
})
